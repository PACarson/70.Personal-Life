/**
 * 46_AIConnector.gs
 * Personal Life OS v5.2 — AI Connector（Sprint 4）
 *
 * 职责：唯一允许发起真实 AI API 调用的模块——Provider-agnostic（不
 * 绑定某一家），路由到 Anthropic/OpenAI/Gemini/DeepSeek 四家里配置好
 * 的那一家。选这四家不是随便挑的：00_Data_Ownership.gs 的 Metadata
 * Standard 里 suggested_by 枚举本来就列了
 * 'Claude'/'ChatGPT'/'Gemini'/'DeepSeek'，这里直接对应实现，不用再
 * 猜 Carson 可能用哪家。
 *
 * 配置（SecureConfig，本文件不硬编码任何密钥）：
 *   AI_PROVIDER   — 'ANTHROPIC'（默认）|'OPENAI'|'GEMINI'|'DEEPSEEK'
 *   AI_API_KEY    — 对应厂商的 API Key（必填，没配会明确报错，不是
 *                   静默失败）
 *   AI_MODEL      — 可选，不填则用每家的合理默认值（见
 *                   _defaultModelFor_）
 *
 * 架构边界：本文件是全项目唯一一个会发起外部网络请求（除了未来可能
 * 的 Reminder OS 之外）的模块——所有需要"调 AI"的地方（
 * 22_PriorityEngine/40_ReviewEngine/47_AIPlanningEngine）都必须经过
 * 这里，不允许各自直接写 UrlFetchApp.fetch()，否则 Provider 换一次
 * 全项目到处都要改。
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : 把"给我一段文字回复"这个请求，路由到
 *                           已配置的 AI Provider，处理各家不同的
 *                           请求/响应格式差异
 *   Owns                  : 各 Provider 的请求体/响应体格式转换
 *   Reads                 : SecureConfig（AI_PROVIDER/AI_API_KEY/
 *                           AI_MODEL）
 *   Writes                : none（不写 Sheet，不发 Event——AI 调用
 *                           本身不是需要留痕的业务事实，调用方拿到
 *                           结果后，如果要落地成 Task/Project/Review
 *                           等业务对象，走各自正常的创建/生成
 *                           流程，那才是需要发布 Event 的部分）
 *   Public API            : callAI_（返回纯文本）,
 *                           callAIForJSON_（返回解析后的 JSON 对象，
 *                           解析失败明确报错，不静默返回 null）
 *   Dependencies           : 01_SecureConfig.gs、GAS 内建
 *                           UrlFetchApp
 *   Forbidden Dependencies  : Sheet, Events——本文件是纯粹的外部
 *                           I/O 桥接层
 *   Pure Function            : NO（发起真实网络请求）
 *   Side Effects              : YES（网络请求本身，不涉及任何本项目
 *                           数据的读写）
 *   Notes                      : 本文件只负责"怎么调 AI"，不负责
 *                           "该问 AI 什么"——具体 Prompt 设计在各自
 *                           调用方（PriorityEngine/ReviewEngine/
 *                           AIPlanningEngine），本文件不应该出现任何
 *                           跟"任务优先级""项目建议"这类业务语义相关
 *                           的内容
 */

var AIConnector = (function () {

  var DEFAULT_MODELS = {
    'ANTHROPIC': 'claude-sonnet-4-6',
    'OPENAI':    'gpt-4o-mini',
    'GEMINI':    'gemini-1.5-flash',
    'DEEPSEEK':  'deepseek-chat'
  };

  function _defaultModelFor_(provider) {
    return DEFAULT_MODELS[provider] || DEFAULT_MODELS.ANTHROPIC;
  }

  function _requireApiKey_() {
    var apiKey = SecureConfig.getKey('AI_API_KEY');
    if (!apiKey) {
      throw new Error('AI_NOT_CONFIGURED: 请先设置 SecureConfig.setKey("AI_API_KEY", "你的密钥")，' +
        '并按需设置 SecureConfig.setKey("AI_PROVIDER", "ANTHROPIC"|"OPENAI"|"GEMINI"|"DEEPSEEK")（默认 ANTHROPIC）');
    }
    return apiKey;
  }

  // ============ 各 Provider 的实际调用 ============

  function _callAnthropic_(prompt, apiKey, model) {
    var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify({
        model: model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      }),
      muteHttpExceptions: true
    });

    var body = JSON.parse(response.getContentText());
    if (response.getResponseCode() !== 200) {
      throw new Error('AI_API_ERROR(Anthropic, HTTP ' + response.getResponseCode() + '): ' +
        (body.error && body.error.message ? body.error.message : response.getContentText()));
    }
    var textBlock = (body.content || []).filter(function (b) { return b.type === 'text'; })[0];
    return textBlock ? textBlock.text : '';
  }

  function _callOpenAI_(prompt, apiKey, model) {
    var response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      payload: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }]
      }),
      muteHttpExceptions: true
    });

    var body = JSON.parse(response.getContentText());
    if (response.getResponseCode() !== 200) {
      throw new Error('AI_API_ERROR(OpenAI, HTTP ' + response.getResponseCode() + '): ' +
        (body.error && body.error.message ? body.error.message : response.getContentText()));
    }
    return (body.choices && body.choices[0] && body.choices[0].message) ? body.choices[0].message.content : '';
  }

  function _callGemini_(prompt, apiKey, model) {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
      muteHttpExceptions: true
    });

    var body = JSON.parse(response.getContentText());
    if (response.getResponseCode() !== 200) {
      throw new Error('AI_API_ERROR(Gemini, HTTP ' + response.getResponseCode() + '): ' +
        (body.error && body.error.message ? body.error.message : response.getContentText()));
    }
    var candidate = body.candidates && body.candidates[0];
    var part = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
    return part ? part.text : '';
  }

  /** DeepSeek 的 API 格式是 OpenAI 兼容的，只是 endpoint 和默认 model 不同 */
  function _callDeepSeek_(prompt, apiKey, model) {
    var response = UrlFetchApp.fetch('https://api.deepseek.com/chat/completions', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      payload: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }]
      }),
      muteHttpExceptions: true
    });

    var body = JSON.parse(response.getContentText());
    if (response.getResponseCode() !== 200) {
      throw new Error('AI_API_ERROR(DeepSeek, HTTP ' + response.getResponseCode() + '): ' +
        (body.error && body.error.message ? body.error.message : response.getContentText()));
    }
    return (body.choices && body.choices[0] && body.choices[0].message) ? body.choices[0].message.content : '';
  }

  // ============ 对外接口 ============

  /**
   * @param {string} prompt
   * @param {object} [options]  { model }（不传则用 AI_MODEL 配置或默认值）
   * @returns {string}  AI 回复的纯文本
   * @throws {Error}  message 以 "AI_NOT_CONFIGURED"/"AI_API_ERROR"/
   *                  "AI_PROVIDER_UNKNOWN" 开头
   */
  function callAI_(prompt, options) {
    options = options || {};
    var provider = String(SecureConfig.getKey('AI_PROVIDER') || 'ANTHROPIC').toUpperCase();
    var apiKey = _requireApiKey_();
    var model = options.model || SecureConfig.getKey('AI_MODEL') || _defaultModelFor_(provider);

    switch (provider) {
      case 'ANTHROPIC': return _callAnthropic_(prompt, apiKey, model);
      case 'OPENAI':     return _callOpenAI_(prompt, apiKey, model);
      case 'GEMINI':     return _callGemini_(prompt, apiKey, model);
      case 'DEEPSEEK':   return _callDeepSeek_(prompt, apiKey, model);
      default:
        throw new Error('AI_PROVIDER_UNKNOWN: 不认识的 AI_PROVIDER="' + provider + '"，目前支持 ANTHROPIC/OPENAI/GEMINI/DEEPSEEK');
    }
  }

  /**
   * 跟 callAI_ 一样，但额外要求/解析 JSON 格式的回复——调用方应该在
   * prompt 里明确要求"只回复 JSON，不要任何其它文字"，本函数负责把
   * 回复里可能夹带的 ```json 代码块标记去掉再解析。
   *
   * @param {string} prompt
   * @param {object} [options]
   * @returns {object}
   * @throws {Error}  除了 callAI_ 可能抛的错误外，解析失败会抛
   *                  "AI_RESPONSE_NOT_JSON: ..."（带上原始回复内容，
   *                  方便调整 Prompt）
   */
  function callAIForJSON_(prompt, options) {
    var raw = callAI_(prompt, options);
    var cleaned = String(raw).replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      throw new Error('AI_RESPONSE_NOT_JSON: AI 没有按要求回复合法 JSON，原始回复: ' + raw);
    }
  }

  return {
    callAI_:         callAI_,
    callAIForJSON_:  callAIForJSON_
  };
})();