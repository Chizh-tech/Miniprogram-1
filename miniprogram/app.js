// app.js
if (!wx.cloud) {
  console.error("请使用 2.2.3 或以上的基础库以使用云能力");
} else {
  wx.cloud.init({
    // 删掉 this.globalData.env，直接粘贴你的 ID，记得带上单引号
    env: 'cloud1-3gqoorfh18041b55', 
    traceUser: true,
  });
}