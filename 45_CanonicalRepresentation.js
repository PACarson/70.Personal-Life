/**
 * 45_CanonicalRepresentation.gs
 * Personal Life OS v5.2 — Canonical Identity + Canonical Lifecycle 映射
 *
 * 完整设计见设计包 00_ADR.gs ADR-2026-07-24-016（Canonical Identity）
 * 和 ADR-2026-07-24-017（Canonical Entity Lifecycle）。
 *
 * 职责：两件事，都是纯函数，都不碰任何 Sheet——
 *   (a) 组装 Canonical Identity（Domain+EntityType+EntityID+Version 四段式）
 *   (b) 把 Task 的原生 status 映射成 Canonical Entity Lifecycle 词汇
 *       （Project/Workflow 不需要映射——v5.2 起它们的原生 status 本来
 *       就是 Canonical 词汇）
 *
 * 架构铁律：
 *  - 本模块不读写任何 Sheet，不调用 EventBus，不依赖任何其他 Engine
 *  - 纯函数：输入相同 → 输出必然相同
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : Canonical Identity 组装 + Task 状态到
 *                           Canonical Lifecycle 的映射
 *   Owns                  : Task 状态映射表本身
 *   Reads                 : none
 *   Writes                : none
 *   Public API            : composeCanonicalIdentity_, mapTaskStatusToCanonical_
 *   Dependencies          : 无
 *   Forbidden Dependencies: Sheet 读写、任何其它 Engine
 *   Pure Function         : YES（全部函数）
 *   Thread Safety         : 不需要（无共享可变状态）
 *   Side Effects          : NO
 */

var CanonicalRepresentation = (function () {

  var DOMAIN_PERSONAL_LIFE = 'PERSONAL_LIFE';

  // Task 原生 status → Canonical Entity Lifecycle，完整表见设计包
  // 00_Business_Rules.gs「十」。
  var TASK_STATUS_MAP = {
    'PENDING':      'READY',
    'DONE':         'COMPLETED',
    'CANCELLED':    'CANCELLED',
    'BLOCKED':      'BLOCKED',
    'WAITING':      'WAITING',
    'CONVERTED':    'ARCHIVED',
    'NOT_SELECTED': 'CANCELLED'
  };

  /**
   * 组装 Canonical Identity（ADR-016）。不改变任何实体既有的 entity_id
   * 生成机制——这里只是把 Domain/EntityType/EntityID/Version 四个已经
   * 存在（或有默认值）的部分包成统一形状，供 Execution Reference /
   * 未来 AI 消费方使用。
   *
   * @param {string} entityType  'TASK' | 'PROJECT' | 'WORKFLOW' | 'NOTE' |
   *                              'REVIEW' | 'BUSINESS_RULE' |
   *                              'WORKFLOW_TEMPLATE'
   * @param {string} entityId    已有的主键，如 'PRJ-20260724-B7C2D1'
   * @param {string} [version]   不传则默认 'V1'（大多数实体没有真正的
   *                              版本概念，见 ADR-016）；WorkflowTemplate
   *                              传入真实版本号，如 'V2'
   * @param {string} [domain]    不传则默认本项目的 Domain
   *                              （'PERSONAL_LIFE'）——预留给未来跨
   *                              Domain OS 共用这份工具时显式指定
   * @returns {{domain:string, entity_type:string, entity_id:string,
   *            version:string}}
   */
  function composeCanonicalIdentity_(entityType, entityId, version, domain) {
    return {
      domain:      domain || DOMAIN_PERSONAL_LIFE,
      entity_type: String(entityType || '').toUpperCase(),
      entity_id:   String(entityId || ''),
      version:     version ? ('V' + String(version).replace(/^V/i, '')) : 'V1'
    };
  }

  /**
   * 把 Canonical Identity 对象格式化成人类可读的字符串，例如
   * "PERSONAL_LIFE/TASK/TSK-20260724-ABC123/V1"——纯展示用，不用于比较
   * 或存储（比较/存储请用对象本身或各字段分别比较）。
   * @param {object} identity  composeCanonicalIdentity_ 的返回值
   * @returns {string}
   */
  function formatCanonicalIdentity_(identity) {
    if (!identity) return '';
    return [identity.domain, identity.entity_type, identity.entity_id, identity.version].join('/');
  }

  /**
   * Task 原生 status → Canonical Entity Lifecycle（ADR-017）。
   * Project/Workflow 不需要这个函数——它们的原生 status 已经是
   * Canonical 词汇，直接使用即可。
   *
   * @param {string} nativeStatus  Task 表里的原生 status 值
   * @returns {string}  Canonical 词汇；无法识别的输入原样返回（不静默
   *                     吞掉，方便调用方发现未覆盖到的新状态值）
   */
  function mapTaskStatusToCanonical_(nativeStatus) {
    var key = String(nativeStatus || '').toUpperCase();
    return TASK_STATUS_MAP.hasOwnProperty(key) ? TASK_STATUS_MAP[key] : key;
  }

  return {
    composeCanonicalIdentity_:  composeCanonicalIdentity_,
    formatCanonicalIdentity_:   formatCanonicalIdentity_,
    mapTaskStatusToCanonical_:  mapTaskStatusToCanonical_
  };
})();
