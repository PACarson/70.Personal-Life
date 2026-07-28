/**
 * 29_NoteEngine.gs
 * Personal Life OS v5.2 — Note Engine（create / archive，Sprint 3）
 *
 * 完整设计见设计包 00_Module_Responsibility.gs「四」。
 *
 * 职责：Note 的创建、归档；Note→Task/Project/Goal Candidate 转换的
 * 发起方（实际转换编排交给 42_ConversionEngine.gs，本 Engine 只负责
 * "把一条 Note 标记为已转换"这个 Note 自己的状态变化）。
 *
 * 硬性边界（不是暂时没做，是刻意的约束）：Note 没有 Reminder、没有
 * Deadline——createNote 的 meta 如果携带 due_date/due_time/
 * reminder_policy 类字段，直接拒绝并返回错误，不静默丢弃。
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : Note 的创建、归档、标记转换
 *   Owns                  : category 枚举；Note 不允许携带 Reminder/
 *                           Deadline 字段这条边界的强制校验
 *   Reads                 : 单个 note（通过 NoteQueryEngine.getNote）
 *   Writes                : Events（通过 EventBus.publish）
 *   Public API            : createNote, createNoteDirect_, archiveNote,
 *                           markNoteConverted_
 *   Dependencies           : 09_IdempotencyManager.gs、
 *                           07_IdentityEngine.gs、17_NoteQueryEngine.gs
 *   Forbidden Dependencies  : Sheet 直接读写、Telegram/Output、
 *                           09_TemporalParser.gs（Note 不解析时间，
 *                           呼应 Owns 一行）
 *   Pure Function            : NO
 *   Side Effects              : YES
 */

var LifeNoteConfig = Object.freeze({
  NOTES_SHEET_NAME: 'Notes',
  NOTE_CATEGORIES: ['IDEA', 'REFERENCE', 'MEETING_NOTES', 'RANDOM_THOUGHT', 'FUTURE_PLAN'],
  NOTE_STATUSES: ['OPEN', 'CONVERTED', 'ARCHIVED'],
  CREATED_METHODS:  ['Manual', 'AI Suggestion', 'Rule Generated', 'Imported', 'Converted'],
  APPROVAL_STATUSES: ['APPROVED', 'PENDING', 'REJECTED'],
  // Note 硬性禁止携带的字段——见文件头"硬性边界"
  FORBIDDEN_FIELDS: ['due_date', 'due_time', 'due_datetime', 'reminder_policy']
});

var NoteEngine = (function () {

  var CFG = LifeNoteConfig;

  function _resolveMetadata_(meta, chatId) {
    var creator = meta.creator === 'AI' ? 'AI' : 'User';
    var isAiCreated = (creator === 'AI');

    return {
      creator:          creator,
      suggested_by:     meta.suggested_by || (isAiCreated ? '' : 'User'),
      source_domain:    meta.source_domain || 'Personal Life',
      source_module:    meta.source_module || '',
      source_event_id:  meta.source_event_id || '',
      source_task_id:   meta.source_task_id || '',
      created_method:   CFG.CREATED_METHODS.indexOf(meta.created_method) !== -1 ? meta.created_method : 'Manual',
      decision_owner:   meta.decision_owner || String(chatId || ''),
      approval_status:  isAiCreated ? 'PENDING' : 'APPROVED'
    };
  }

  // ============ Create ============

  /**
   * @throws {Error}  message 以 "INVALID_FIELD" 开头，如果 meta 携带了
   *                  Note 不允许有的 Reminder/Deadline 类字段
   */
  function createNote(content, meta, chatId) {
    meta = meta || {};

    var forbidden = CFG.FORBIDDEN_FIELDS.filter(function (f) { return meta.hasOwnProperty(f); });
    if (forbidden.length > 0) {
      throw new Error('INVALID_FIELD: Note 不支持 Reminder/Deadline，收到了不允许的字段: ' + forbidden.join(', ') +
        '——如果这件事需要提醒/截止日期，应该建 Task 或 Project，不是 Note。');
    }

    var result = IdempotencyManager.createNoteIfNotExists(content, meta, chatId);
    return result.note;
  }

  /**
   * 实际创建函数 —— 只由 09_IdempotencyManager.createNoteIfNotExists()
   * 调用（已在锁内，且已经过 createNote() 的字段校验）。
   */
  function createNoteDirect_(content, meta, chatId, identity) {
    meta = meta || {};

    var category = CFG.NOTE_CATEGORIES.indexOf(meta.category) !== -1 ? meta.category : 'IDEA';
    var metadata = _resolveMetadata_(meta, chatId);
    var nowIso = new Date().toISOString();

    var note = {
      note_id:            generateNoteId_(),
      identity:            identity || '',
      content:              content,
      category:              category,
      status:                 'OPEN',
      converted_to_type:         '',
      converted_to_id:            '',
      chat_id:                     chatId || '',

      creator:          metadata.creator,
      suggested_by:     metadata.suggested_by,
      source_domain:    metadata.source_domain,
      source_module:    metadata.source_module,
      source_event_id:  metadata.source_event_id,
      source_task_id:   metadata.source_task_id,
      created_method:   metadata.created_method,
      created_time:     nowIso,
      updated_time:     nowIso,
      decision_owner:   metadata.decision_owner,
      approval_status:  metadata.approval_status
    };

    EventBus.publish('NOTE_CREATED', note, chatId, 'NoteEngine', identity);

    return note;
  }

  // ============ Archive ============

  function archiveNote(noteId, chatId) {
    var existing = NoteQueryEngine.getNote(noteId, chatId);
    if (!existing) return { not_found: true };

    var currentStatus = String(existing.status || '').toUpperCase();
    if (currentStatus === 'ARCHIVED') return { already_archived: true };
    if (currentStatus === 'CONVERTED') {
      return { invalid_state: true, current_status: currentStatus,
        reason: '已经转换过的 Note 不能再归档——它的历史通过转换目标（Task/Project）延续，不是本条 Note 自己的终态' };
    }

    var event = EventBus.publish('NOTE_ARCHIVED', { note_id: noteId }, chatId, 'NoteEngine');
    if (event && event.projection_ok === false) {
      materializeNoteRow_(noteId, { status: 'ARCHIVED' });
    }

    return {};
  }

  // ============ 转换标记（仅供 42_ConversionEngine.gs 调用） ============

  /**
   * 【仅供 42_ConversionEngine.gs 调用】把一条 Note 标记为已转换。
   * 只允许从 OPEN 状态转换；已经是 CONVERTED/ARCHIVED 的 Note 拒绝
   * 重复转换（幂等：如果已经转换到同一个目标，直接返回既有结果，不
   * 报错——见 00_Business_Rules.gs「一」Note 转换的幂等规则）。
   *
   * @param {string} noteId
   * @param {string} targetType  'TASK'|'PROJECT'|'GOAL_CANDIDATE'
   * @param {string} targetId    GOAL_CANDIDATE 时为空
   * @param {string} chatId
   */
  function markNoteConverted_(noteId, targetType, targetId, chatId) {
    var existing = NoteQueryEngine.getNote(noteId, chatId);
    if (!existing) return { not_found: true };

    var currentStatus = String(existing.status || '').toUpperCase();
    if (currentStatus === 'CONVERTED') {
      if (existing.converted_to_type === targetType && existing.converted_to_id === (targetId || '')) {
        return { already_converted: true, note: existing }; // 幂等：同一个目标，直接返回
      }
      return { invalid_state: true, current_status: currentStatus,
        reason: 'Note 已经转换到另一个目标（' + existing.converted_to_type + '/' + existing.converted_to_id + '），不能再转换一次' };
    }
    if (currentStatus === 'ARCHIVED') {
      return { invalid_state: true, current_status: currentStatus, reason: '已归档的 Note 不能再转换' };
    }

    var payload = { note_id: noteId, target_type: targetType, target_id: targetId || '' };
    var event = EventBus.publish('NOTE_CONVERTED', payload, chatId || existing.chat_id, 'NoteEngine');

    if (event && event.projection_ok === false) {
      materializeNoteRow_(noteId, { status: 'CONVERTED', converted_to_type: targetType, converted_to_id: targetId || '' });
    }

    return {};
  }

  // ============ 派生引擎（保留供 11_ProjectionRebuilder 使用） ============

  function deriveFromEvent(event, stateMap) {
    stateMap = stateMap || {};
    var p = event.payload || {};

    switch (event.type) {
      case 'NOTE_CREATED':
        stateMap[p.note_id] = shallowCopy_(p);
        break;
      case 'NOTE_ARCHIVED':
        if (stateMap[p.note_id]) stateMap[p.note_id].status = 'ARCHIVED';
        break;
      case 'NOTE_CONVERTED':
        if (stateMap[p.note_id]) {
          stateMap[p.note_id].status = 'CONVERTED';
          stateMap[p.note_id].converted_to_type = p.target_type;
          stateMap[p.note_id].converted_to_id = p.target_id;
        }
        break;
    }
    return stateMap;
  }

  function materializeNoteRow_(noteId, knownNote) {
    if (!knownNote) return;
    upsertRowByKey_(CFG.NOTES_SHEET_NAME, 'note_id', noteId, knownNote);
  }

  // ============ 内部工具 ============

  function generateNoteId_() {
    var tz = Session.getScriptTimeZone();
    var today = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
    var uniqueSuffix = Utilities.getUuid().split('-')[0].toUpperCase();
    return 'NOTE-' + today + '-' + uniqueSuffix;
  }

  return {
    createNote:           createNote,
    createNoteDirect_:    createNoteDirect_,
    archiveNote:          archiveNote,
    markNoteConverted_:   markNoteConverted_,
    deriveFromEvent:      deriveFromEvent,
    materializeNoteRow_:  materializeNoteRow_
  };
})();
