const db = wx.cloud.database();

Page({
  data: {
    diaries: []
  },

  // 1. 每次进入页面时刷新数据
  onShow: function() {
    this.fetchDiaries();
  },

  // 2. 获取数据列表
  fetchDiaries() {
    wx.showLoading({ title: '加载中...' });
    
    db.collection('diaries')
      .orderBy('createTime', 'desc')
      .get({
        success: (res) => {
          const formattedData = res.data.map(item => {
            const date = item.createTime || new Date();
            return {
              ...item,
              formattedTime: date.toLocaleString()
            };
          });
          
          this.setData({
            diaries: formattedData
          });
          wx.hideLoading();
        },
        fail: (err) => {
          wx.hideLoading();
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
      });
  },

  // 3. 删除功能 (现在移动到了 Page 内部)
  deleteDiary(e) {
    const docId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '提示',
      content: '确定要删除这篇日记吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });

          db.collection('diaries').doc(docId).remove({
            success: (res) => {
              wx.hideLoading();
              wx.showToast({ title: '已删除', icon: 'success' });
              this.fetchDiaries(); // 重新加载列表
            },
            fail: (err) => {
              wx.hideLoading();
              wx.showToast({ title: '删除失败', icon: 'none' });
              console.error('删除报错：', err);
            }
          });
        }
      }
    });
  },

  // 4. 图片预览
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      urls: [url],
      current: url
    });
  }
}); 