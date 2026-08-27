/**
 * 23_ReminderRequestConsumer.js
 * Reminder OS — REMINDER_REQUESTED（entity_type: TASK）事件消费者
 *
 * 【背景】关闭 Personal Life OS → REMINDER_REQUESTED → Reminder OS
 * 这条集成缺口里 TASK 路径的最后一环——Producer（43_ReminderConnector.gs
 * 的 requestWorkflowStepReminder）早已交付并通过 Sprint 3 Acceptance
 * Gate，但 Reminder OS 这一侧此前完全没有代码读取这个事件。完整背景、
 * 候选方案对比、被拒绝方案的理由见：
 *   00_Architecture_Review_ProjectWorkflow_Reminder_Integration.js（评审）
 *   00_Implementation_Plan_TaskReminder_EventConsumer.js（实现计划）
 * PROJECT 路径（entity_type: 'PROJECT'）明确 explicitly deferred，本文件
 * 只处理 'TASK'，遇到其它 entity_type 直接跳过（见 consumeReminderRequests
 * 主循环）。
 *
 * 【Carson 2026-08-27 批准的语义（Option 1 — replace）】同一个 task_id
 * 被多次登记、且 reminder_policy 不同：后一次替换前一次，旧登记不再生效；
 * 必须幂等——重复收到同一个请求/policy 不能产生重复提醒；Domain Task
 * 仍然是唯一可信来源，Reminder OS 只维护从它派生出来的调度状态；不改动
 * Task identity 契约（本文件从不涉及 Personal Life OS 的
 * generateTaskIdentity()/scopeKey，只用 task_id 做单纯的查找 key）。
 *
 * 【关键设计决定：只在 policy 真的变了的时候才替换】"幂等"这条要求逐字
 * 兑现，不能只满足在"最终状态不重复"这个弱版本上——如果收到两次一模一样
 * 的 policy 就无条件"先删旧、再插新"，会让 rule_id 每次都换新的、
 * resolved_fire_ats 每次归零，一旦这个重复发生在某个 offset 已经真正
 * 发送过提醒之后，会让那条 offset 被当成"从未处理过"而重新发送一遍——
 * 这才是真正的幂等违反。所以下面的实现会先比较"这个 task_id 现有登记的
 * offset 集合"跟"这次事件解析出的 offset 集合"，完全相同就直接跳过、
 * 不碰任何已有规则行；只有集合不同（包括从无到有）才执行删旧插新。
 *
 * 【为什么不直接调用 EventBus.getEventsByType()】20_EventBus.js 的
 * getAllEvents()/getEventsByType() 是对共享 Events 表【从第2行到
 * lastRow 整表读取，per-execution 内存缓存，不跨执行持久化】——Events
 * 由 Personal AI Core/Personal Life OS/Reminder OS 三个项目共同追加、
 * 只增不删（Personal-Life-main 的 00_Project_Constitution.js:102 明确
 * "没有任何 update/delete Event 的 API"）。把这样一次全表扫描接进一个
 * 每 5 分钟跑一次的常驻触发器，会重新引入这个代码库已经修过两次的同一类
 * 问题（ReminderHistory 曾经的写入模式、22_QueryEngine.js 2026-07-11
 * HIGH RISK 2 那次从"直接查 Tasks"改成"先查 ActiveTasks"的教训）。本文件
 * 改用行号水位（PropertiesService）+ 只读增量区间的方式，读取量正比于
 * "这一轮新增的 Events 行数"，不正比于 Events 表的历史总量。
 *
 * 【实现过程中额外发现、已在 Implementation Plan 里更正的一处引用错误】
 * 本文件设计阶段最初参照的是 02_EventBus.js——那是 2026-07-06 改名迁移
 * 后遗留在仓库里、事实上已经不生效的旧文件（真正生效的是本文件真正
 * 依赖的 20_EventBus.js：20_ReminderEngine.js 调用的
 * EventBus.publishBatch 只存在于 20_EventBus.js，02_EventBus.js 没有这个
 * 方法）。本文件不直接调用 EventBus 的任何方法（见上一条，改走
 * SheetUtils 直接读 Events 表），这处更正不影响本文件的实现，只影响
 * 引用的准确性——如实记录，供以后核对时不再走弯路。
 *
 * 【生产调用方现状】43_ReminderConnector.js 的 requestWorkflowStepReminder
 * 目前在 Personal Life OS 里没有任何生产调用方（唯一调用点是
 * 36_Tests_Sprint3Acceptance.js:271）。本文件补齐的是"消费层"，不代表
 * 这条链路在真实用户操作下已经被触发——那是一个独立、未经批准的决定，
 * 不在本次范围内。
 */

var ReminderRequestConsumer = (function () {

  var EVENTS_SHEET = 'Events';
  var RULES_SHEET = 'ReminderRules';
  var SOURCE_TAG = 'event_registered';

  var LAST_ROW_KEY = 'REMINDER_REQUEST_CONSUMER_LAST_ROW';
  var LOCK_WAIT_MS = 10000; // 跟 20_ReminderEngine.js 的 LOCK_WAIT_MS 保持一致
  var STALE_EVENT_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2小时——明显大于任何
    // 合理的 ActiveTasks 投影同步延迟，又不至于让一个真正失效的事件挂
    // 太久。具体数字可调，不是需要精确论证的科学常数。

  // ---------- 私有 helper（跟 20_ReminderEngine.js 里同名函数逐字一致——
  // 各文件按需自带私有 helper 是这个代码库的既有惯例，IIFE 内部函数本来
  // 就不跨文件共享，20_ReminderEngine.js 自己的这两个函数也没有导出）----

  function _parseJsonSafe_(str, fallback) {
    if (!str) return fallback;
    try {
      var parsed = JSON.parse(str);
      return parsed || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function _offsetToMinutes_(offset) {
    if (!offset || typeof offset.value !== 'number') return null;
    switch (offset.unit) {
      case 'minutes': return offset.value;
      case 'hours':   return offset.value * 60;
      case 'days':    return offset.value * 1440;
      default:        return null;
    }
  }

  function _offsetLabel_(minutes) {
    if (minutes >= 1440 && minutes % 1440 === 0) return (minutes / 1440) + ' day(s) before';
    if (minutes >= 60 && minutes % 60 === 0) return (minutes / 60) + ' hour(s) before';
    return minutes + ' minute(s) before';
  }

  function _generateRuleId_() {
    return 'RULE-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  }

  // 【Track 1B / UIBridge sanitizer 同款教训】Sheets 读回来的日期类字段
  // 有可能是原生 Date 对象而不是字符串（取决于单元格格式），这个代码库
  // 已经因为这一点踩过两次坑（Personal-Life-main 的 Due-Date
  // Canonicalization、UIBridge Date 序列化问题）。event.timestamp 同理
  // 防御处理，不假设它一定是字符串。
  function _toDateSafe_(value) {
    if (value instanceof Date) return value;
    return new Date(value);
  }

  // ---------- Events 读取：只读增量区间 ----------

  function _readEventsRange_(startRow, endRow) {
    if (endRow < startRow) return [];
    var sheet = SheetUtils.getSheet_(EVENTS_SHEET);
    var headerMap = SheetUtils.getHeaderMap_(sheet);
    var numCols = sheet.getLastColumn();
    var values = sheet.getRange(startRow, 1, endRow - startRow + 1, numCols).getValues();
    return values.map(function (row) {
      var obj = {};
      Object.keys(headerMap).forEach(function (name) {
        obj[name] = row[headerMap[name]];
      });
      return obj;
    });
  }

  function _getWatermark_() {
    var stored = PropertiesService.getScriptProperties().getProperty(LAST_ROW_KEY);
    return stored ? Number(stored) : 1; // 1 = 表头行；首次运行从第2行开始
  }

  function _setWatermark_(row) {
    PropertiesService.getScriptProperties().setProperty(LAST_ROW_KEY, String(row));
  }

  // ---------- 现有"事件登记来源"规则查询：{ task_id: [{rule_id, offset_minutes}, ...] } ----------
  // ReminderRules 是有界表（20_ReminderEngine.js header 已确认这类表可以
  // 整表读——只保留当前活跃规则，任务离开 pending 集合时既有规则会被删掉），
  // 全表扫描在这里是已经被这个代码库接受的成本，不是新引入的风险。

  function _getExistingEventRegisteredRules_() {
    var sheet = SheetUtils.getSheet_(RULES_SHEET);
    var headerMap = SheetUtils.getHeaderMap_(sheet);
    var lastRow = sheet.getLastRow();
    var map = {};
    if (lastRow < 2) return map;
    var values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    values.forEach(function (row) {
      if (row[headerMap.source] !== SOURCE_TAG) return;
      var taskId = String(row[headerMap.task_id]);
      if (!map[taskId]) map[taskId] = [];
      map[taskId].push({
        rule_id: row[headerMap.rule_id],
        offset_minutes: Number(row[headerMap.offset_minutes])
      });
    });
    return map;
  }

  function _sameOffsetSet_(existingEntries, newOffsetMinutesList) {
    var a = existingEntries.map(function (e) { return e.offset_minutes; }).sort(function (x, y) { return x - y; });
    var b = newOffsetMinutesList.slice().sort(function (x, y) { return x - y; });
    return JSON.stringify(a) === JSON.stringify(b);
  }

  // ---------- 主流程 ----------

  function consumeReminderRequests() {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(LOCK_WAIT_MS);
    } catch (e) {
      // 【故意不加 _scheduleRetry_ 式的一次性补跑触发器】
      // 20_ReminderEngine.js 的 checkOffsetReminders 拿不到锁时会额外
      // 安排一次重试触发器（_scheduleRetry_），因为那关系到"提醒是否
      // 按时发出"。这里只是登记一个 task_id 的提醒策略，晚一个 5 分钟
      // 周期不构成同等级别的正确性风险，用更简单的"跳过，下一次常规
      // 触发器自然会重跑"就够了——按最小实现原则，不照抄一个这里用不上
      // 的复杂度。
      Logger.log('[ReminderRequestConsumer] 拿不到锁（上一轮可能还没跑完），跳过本轮');
      return { processed: 0, skippedNotTask: 0, stale: 0, pendingRetry: 0, unchanged: 0 };
    }

    try {
      var sheet = SheetUtils.getSheet_(EVENTS_SHEET);
      var lastRow = sheet.getLastRow();
      var watermark = _getWatermark_();

      if (lastRow <= watermark) {
        return { processed: 0, skippedNotTask: 0, stale: 0, pendingRetry: 0, unchanged: 0 };
      }

      var newRows = _readEventsRange_(watermark + 1, lastRow);
      var pendingTasks = QueryEngine.getPendingTasks();
      var pendingTaskById = {};
      pendingTasks.forEach(function (t) { pendingTaskById[String(t.task_id)] = t; });

      var existingByTaskId = _getExistingEventRegisteredRules_();
      var newRules = [];
      var ruleDeletes = [];

      var processed = 0, skippedNotTask = 0, stale = 0, pendingRetry = 0, unchanged = 0;
      var advancedTo = watermark;

      for (var i = 0; i < newRows.length; i++) {
        var currentRowNum = watermark + 1 + i;
        var evt = newRows[i];

        if (evt.type !== 'REMINDER_REQUESTED') {
          advancedTo = currentRowNum;
          continue;
        }

        var payload = _parseJsonSafe_(evt.payload, null);
        if (!payload || payload.entity_type !== 'TASK') {
          // PROJECT 或其它 entity_type——explicitly deferred，不处理，
          // 水位正常推进过它，不阻塞后面的事件。
          advancedTo = currentRowNum;
          skippedNotTask++;
          continue;
        }

        var taskId = payload.entity_id;
        var policy = payload.reminder_policy;

        if (!taskId || !policy || !policy.offsets || policy.offsets.length === 0) {
          // 空/无效 policy——不落到"按 task.priority 查默认策略"那条只
          // 适用于 Task 创建时刻的分支（_ensureRulesFromPolicy_ 的语义，
          // 20_ReminderEngine.js:302-314），直接判定这条请求本身无效。
          Logger.log('[ReminderRequestConsumer] 事件（第' + currentRowNum + '行，event_id=' +
            evt.event_id + '）reminder_policy 为空或没有 offsets，判定无效，跳过');
          advancedTo = currentRowNum;
          continue;
        }

        var task = pendingTaskById[String(taskId)];
        if (!task) {
          var eventAgeMs = Date.now() - _toDateSafe_(evt.timestamp).getTime();
          if (eventAgeMs < STALE_EVENT_TIMEOUT_MS) {
            // 可能是 Task 刚创建、ActiveTasks 投影还没同步上——本轮到此
            // 为止，水位停在这一行之前，下一轮重新尝试同一行。不跳过去
            // 处理更晚的事件，避免"水位跳过中间一行"的额外复杂度。
            pendingRetry++;
            break;
          } else {
            Logger.log('[ReminderRequestConsumer] entity_id=' + taskId + '（第' + currentRowNum +
              '行）超过 ' + (STALE_EVENT_TIMEOUT_MS / 3600000) + ' 小时仍不在当前 pending Task ' +
              '集合里，判定 stale，跳过，不生成规则');
            advancedTo = currentRowNum;
            stale++;
            continue;
          }
        }

        var newOffsetMinutesList = policy.offsets.map(_offsetToMinutes_).filter(function (m) { return m !== null; });
        if (newOffsetMinutesList.length === 0) {
          Logger.log('[ReminderRequestConsumer] 事件（第' + currentRowNum + '行）的 offsets 全部无法' +
            '识别 unit，判定无效，跳过');
          advancedTo = currentRowNum;
          continue;
        }

        var existingEntries = existingByTaskId[String(taskId)] || [];

        if (_sameOffsetSet_(existingEntries, newOffsetMinutesList)) {
          // 【幂等核心】跟现有登记完全相同——不删不插，已有规则的
          // resolved_fire_ats/发送历史原样保留，避免把"已经发送过的
          // 提醒"重新判定成"从未处理过"。
          unchanged++;
          advancedTo = currentRowNum;
          continue;
        }

        // policy 确实变了（或者是这个 task_id 第一次通过这条事件路径登记）
        // ——执行"替换"（Carson 2026-08-27 批准 Option 1）。
        if (existingEntries.length > 0) {
          ruleDeletes = ruleDeletes.concat(existingEntries.map(function (e) { return e.rule_id; }));
        }

        var freshEntries = [];
        newOffsetMinutesList.forEach(function (offsetMinutes) {
          var ruleId = _generateRuleId_();
          freshEntries.push({ rule_id: ruleId, offset_minutes: offsetMinutes });
          newRules.push({
            rule_id: ruleId,
            task_id: task.task_id,
            chat_id: task.chat_id, // 从 Task 权威行读，不用事件 payload 里
                                     // 的快照——Domain Task 是唯一可信
                                     // 来源（Carson 2026-08-27 重申）。
            offset_minutes: offsetMinutes,
            offset_label: _offsetLabel_(offsetMinutes),
            channels: JSON.stringify(['telegram']),
            rule_status: 'active',
            source: SOURCE_TAG,
            resolved_fire_ats: JSON.stringify({}),
            created_at: new Date().toISOString()
          });
        });

        // 本轮内如果同一个 task_id 在更晚的事件里再次出现，让它看到的是
        // "刚刚这一次"而不是本轮开始前的旧快照，避免把这次新插入的规则
        // 又错误地当成"待替换的旧规则"。
        existingByTaskId[String(taskId)] = freshEntries;

        processed++;
        advancedTo = currentRowNum;
      }

      // ---- 落盘：先删旧、再插新——这两步合起来对"重复处理同一批事件"
      // 是幂等的（结果只取决于事件本身，不取决于执行了几次）----
      if (ruleDeletes.length > 0) {
        SheetUtils.batchDeleteRowsByKey_(RULES_SHEET, 'rule_id', ruleDeletes);
      }
      if (newRules.length > 0) {
        SheetUtils.batchUpsertRowsByKey_(RULES_SHEET, 'rule_id', newRules);
      }

      // 只有落盘成功才推进水位——中途抛异常的话水位保持在上一次成功的
      // 位置，下一轮会重新处理同一批；上面的幂等设计保证这样做安全。
      if (advancedTo > watermark) {
        _setWatermark_(advancedTo);
      }

      Logger.log('[ReminderRequestConsumer] 本轮：登记/替换 ' + processed + '，' +
        'policy 未变已跳过 ' + unchanged + '，非 TASK 已跳过 ' + skippedNotTask + '，' +
        '判定 stale ' + stale + '，等待下轮重试 ' + pendingRetry + '。水位 ' +
        watermark + ' → ' + advancedTo);

      return { processed: processed, skippedNotTask: skippedNotTask, stale: stale, pendingRetry: pendingRetry, unchanged: unchanged };
    } finally {
      lock.releaseLock();
    }
  }

  return {
    consumeReminderRequests: consumeReminderRequests
  };
})();

/**
 * 顶层 trigger 绑定函数——GAS 的 time-based trigger 只能绑定全局函数名，
 * 不能绑定 IIFE 内部方法（同 20_ReminderEngine.js 末尾 checkOffsetReminders()
 * 的写法）。
 */
function consumeReminderRequests() {
  return ReminderRequestConsumer.consumeReminderRequests();
}
