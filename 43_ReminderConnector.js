/**
 * 43_ReminderConnector.gs
 * Personal Life OS v5.2 — Reminder Connector（Sprint 3）
 *
 * 完整设计见设计包 00_Module_Responsibility.gs「八」。
 *
 * 职责：把 Project/Workflow 层面的到期提醒需求转换成
 * REMINDER_REQUESTED 事件发布出去（Task 层面的提醒沿用既有
 * reminder_policy 透传机制，不经过本 Connector）。
 *
 * 架构边界：本 Connector 跟 Reminder OS 之间只通过 Events 表耦合，
 * 不直接调用 Reminder OS 的任何函数（见 00_Domain_Boundary.gs「六」）。
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : Project/Workflow 提醒需求 → 事件格式转换
 *   Owns                  : 无业务判断，纯粹的事件格式转换
 *   Reads                 : none
 *   Writes                : Events（REMINDER_REQUESTED）
 *   Public API            : requestProjectReminder,
 *                           requestWorkflowStepReminder
 *   Dependencies           : 02_EventBus.gs
 *   Forbidden Dependencies  : Sheet 读写、直接调用 Reminder OS 的
 *                           任何函数
 *   Pure Function            : YES（纯粹的输入到 Event payload 的
 *                           格式转换）
 *   Side Effects              : 有（发布事件本身算副作用，但不涉及
 *                           任何 Sheet 写入）
 */

var ReminderConnector = (function () {

  /**
   * @param {string} projectId
   * @param {object} reminderPolicy  { offset_minutes } 或其它
   *                                  Reminder OS 认识的策略形状——
   *                                  本 Connector 不解析内容，原样
   *                                  透传
   * @param {string} chatId
   */
  function requestProjectReminder(projectId, reminderPolicy, chatId) {
    var payload = {
      entity_type:      'PROJECT',
      entity_id:        projectId,
      reminder_policy:  reminderPolicy || {}
    };
    EventBus.publish('REMINDER_REQUESTED', payload, chatId, 'ReminderConnector');
  }

  /**
   * @param {string} taskId  Workflow 里某一步（Task）的 id——命名为
   *                          "WorkflowStep"是概念上的说法，实际实体
   *                          仍然是 Task（见设计包
   *                          00_Entity_Relationship.gs：Workflow 没有
   *                          独立的 Step 实体，步骤就是 Task 本身）
   * @param {object} reminderPolicy
   * @param {string} chatId
   */
  function requestWorkflowStepReminder(taskId, reminderPolicy, chatId) {
    var payload = {
      entity_type:      'TASK',
      entity_id:        taskId,
      reminder_policy:  reminderPolicy || {}
    };
    EventBus.publish('REMINDER_REQUESTED', payload, chatId, 'ReminderConnector');
  }

  return {
    requestProjectReminder:       requestProjectReminder,
    requestWorkflowStepReminder:  requestWorkflowStepReminder
  };
})();
