const util = require('../../utils/util');
const storage = require('../../utils/storage');

Page({
  data: {
    diary: null,
    date: '',
    dateDisplay: '',
    currentVideoIndex: -1
  },

  async onLoad(options) {
    const date = options.date;
    this.setData({ date });
    await this.loadDiary();
  },

  async onShow() {
    await this.loadDiary();
  },

  /**
   * 加载日记数据
   */
  async loadDiary() {
    const { date } = this.data;
    const diary = await storage.getDiaryByDate(date);
    if (!diary) {
      wx.showToast({ title: '日记不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }

    const dateObj = util.parseDate(date);
    const dateDisplay = `${date}  ${util.getWeekdayName(dateObj.getDay())}`;

    wx.setNavigationBarTitle({ title: diary.title || '日记详情' });

    this.setData({ diary, dateDisplay });
  },

  /**
   * 预览图片
   */
  previewImage(e) {
    const { index } = e.currentTarget.dataset;
    const { diary } = this.data;
    wx.previewImage({
      urls: diary.images,
      current: diary.images[index]
    });
  },

  /**
   * 编辑日记
   */
  editDiary() {
    const { date } = this.data;
    wx.navigateTo({
      url: `/pages/edit/edit?date=${date}`
    });
  },

  /**
   * 删除日记
   */
  deleteDiary() {
    wx.showModal({
      title: '删除日记',
      content: '确认删除这篇日记？删除后不可恢复。',
      confirmText: '删除',
      confirmColor: '#E25454',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          const { date } = this.data;
          // 删除关联的本地文件
          this.deleteLocalFiles();
          await storage.deleteDiary(date);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 800);
        }
      }
    });
  },

  /**
   * 删除日记关联的本地文件
   */
  deleteLocalFiles() {
    const { diary } = this.data;
    if (!diary) return;

    const fs = wx.getFileSystemManager();
    const filesToDelete = [
      ...(diary.images || []),
      ...(diary.videos || [])
    ];

    filesToDelete.forEach(path => {
      if (path && path.startsWith(wx.env.USER_DATA_PATH)) {
        fs.unlink({ filePath: path, fail: () => {} });
      }
    });
  },

  /**
   * 分享日记
   */
  onShareTap() {
    const { diary, dateDisplay } = this.data;
    const content = `${dateDisplay}\n${diary.weather ? diary.weather.icon + ' ' + diary.weather.text : ''}\n\n${diary.content}`;
    wx.setClipboardData({
      data: content,
      success() {
        wx.showToast({ title: '日记内容已复制', icon: 'success' });
      }
    });
  }
});
