const cloud = require('wx-server-sdk')

// 初始化云环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const { text } = event // 接收小程序前端传来的日记文字

  try {
    // 调用微信内置的 AI 聊天接口
    // 注意：确保你已经在云开发控制台开启了“AI能力”并关联了混元模型
    const result = await cloud.ai.chat({
      model: 'hunyuan-lite', // 建议新手先用轻量版，速度快且免费额度多
      messages: [
        {
          role: 'system',
          content: '你是一个文笔优美的日记润色助手。请保持用户原意，用更富有感染力、更文学化的语言重写这段话。'
        },
        {
          role: 'user',
          content: text
        }
      ]
    })

    return {
      optimized: result.choices[0].message.content
    }

  } catch (err) {
    console.error('AI调用报错：', err)
    return {
      error: err,
      optimized: 'AI 思考时出了点小差，请稍后再试。'
    }
  }
}