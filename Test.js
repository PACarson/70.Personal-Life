function createBlockedProjectForUiTest() {
  var chatId = SecureConfig.getKey('TELEGRAM_CHAT_ID');
  var p = ProjectEngine.createProject('UI测试：装修房子（受阻项目）', {}, chatId);
  TaskEngine.createTask('刷油漆（未完成子任务）', { project_id: p.project_id }, chatId);
}


function setupGeminiConfig() {
  // 1. 指定提供商为 GEMINI
  SecureConfig.setKey('AI_PROVIDER', 'GEMINI');
  
  // 2. 填入你的 Google AI Studio API Key（AIzaSy 开头）
  SecureConfig.setKey('AI_API_KEY', 'AQ.Ab8RN6IDft2UdmO1W-V11Exq59tRAhEOSRAhvpOIKnkmOkx7nQ');
  
  // 3. （可选）模型名称，默认是 gemini-1.5-flash，也支持 gemini-2.0-flash 或 gemini-1.5-pro
  SecureConfig.setKey('AI_MODEL', 'gemini-3.7-flash');
  
  Logger.log('✅ 已成功切换为 Google Gemini');
}
