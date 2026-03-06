const util = require('../../utils/util');
const storage = require('../../utils/storage');
const weatherService = require('../../utils/weather');
const locationService = require('../../utils/location');

Page({
  data: {
    date: '',
    dateDisplay: '',
    weekday: '',
    title: '',
    content: '',
    images: [],
    videos: [],
    location: null,
    weather: null,
    isLoadingLocation: false,
    isLoadingWeather: false,
    isExistingDiary: false,
    isSaving: false
  },

  onLoad(options) {
    const date = options.date || util.formatDate(new Date());
    const dateObj = util.parseDate(date);
    const dateDisplay = `${date}  ${util.getWeekdayName(dateObj.getDay())}`;

    this.setData({ date, dateDisplay });

    // 检查是否已有该日期的日记（编辑模式）
    const existing = storage.getDiaryByDate(date);
    if (existing) {
      this.setData({
        title: existing.title || '',
        content: existing.content || '',
        images: existing.images || [],
        videos: existing.videos || [],
        location: existing.location || null,
        weather: existing.weather || null,
        isExistingDiary: true
      });

      // 历史日记缺少位置/天气信息时自动补拉一次
      if (!existing.location || !existing.weather) {
        this.autoFetchLocationAndWeather();
      }
    } else {
      // 新建模式，自动获取位置和天气
      this.autoFetchLocationAndWeather();
    }
  },

  onShow() {
    wx.setNavigationBarTitle({
      title: this.data.isExistingDiary ? '编辑日记' : '写日记'
    });
  },

  /**
   * 自动获取位置和天气
   */
  autoFetchLocationAndWeather() {
    this.setData({ isLoadingLocation: true, isLoadingWeather: true });

    locationService.getCurrentLocation()
      .then(loc => {
        this.setData({ location: loc, isLoadingLocation: false });
        // 用位置获取天气
        return weatherService.getWeather(loc.latitude, loc.longitude);
      })
      .then(weather => {
        this.setData({ weather, isLoadingWeather: false });
        if (weather && weather.temperature === '--') {
          wx.showToast({ title: weather.text || '天气获取失败', icon: 'none' });
        }
      })
      .catch((err) => {
        this.setData({ isLoadingLocation: false, isLoadingWeather: false });
        if (err && err.type === 'AUTH_DENIED') {
          wx.showModal({
            title: '需要位置权限',
            content: '请在设置中开启“位置信息”权限后重试。',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting({});
              }
            }
          });
          return;
        }

        wx.showToast({ title: (err && err.message) || '定位失败，请重试', icon: 'none' });
      });
  },

  /**
   * 手动刷新位置和天气
   */
  refreshLocationWeather() {
    this.autoFetchLocationAndWeather();
  },

  /**
   * 标题输入
   */
  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  /**
   * 内容输入
   */
  onContentInput(e) {
    this.setData({ content: e.detail.value });
  },

  /**
   * 选择图片
   */
  chooseImages() {
    const currentCount = this.data.images.length;
    const maxCount = 9 - currentCount;
    if (maxCount <= 0) {
      wx.showToast({ title: '最多上传9张图片', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: maxCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map(f => f.tempFilePath);
        // 保存图片到本地文件系统
        this.saveFilesToLocal(newImages, 'image');
      },
      fail: () => {}
    });
  },

  /**
   * 选择视频
   */
  chooseVideo() {
    const currentCount = this.data.videos.length;
    if (currentCount >= 3) {
      wx.showToast({ title: '最多上传3个视频', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      maxDuration: 60,
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath;
        this.saveFilesToLocal([tempPath], 'video');
      },
      fail: () => {}
    });
  },

  /**
   * 保存临时文件到本地文件系统（持久化）
   * @param {string[]} tempPaths
   * @param {'image'|'video'} type
   */
  saveFilesToLocal(tempPaths, type) {
    const fs = wx.getFileSystemManager();
    const savedPaths = [];
    let completed = 0;

    wx.showLoading({ title: '处理中...' });

    tempPaths.forEach(tempPath => {
      const ext = type === 'image' ? '.jpg' : '.mp4';
      const savedPath = `${wx.env.USER_DATA_PATH}/${util.generateId()}${ext}`;

      fs.copyFile({
        srcPath: tempPath,
        destPath: savedPath,
        success: () => {
          savedPaths.push(savedPath);
          completed++;
          if (completed === tempPaths.length) {
            wx.hideLoading();
            if (type === 'image') {
              this.setData({ images: [...this.data.images, ...savedPaths] });
            } else {
              this.setData({ videos: [...this.data.videos, ...savedPaths] });
            }
          }
        },
        fail: () => {
          // 保存失败时直接使用临时路径（会话内有效）
          savedPaths.push(tempPath);
          completed++;
          if (completed === tempPaths.length) {
            wx.hideLoading();
            if (type === 'image') {
              this.setData({ images: [...this.data.images, ...savedPaths] });
            } else {
              this.setData({ videos: [...this.data.videos, ...savedPaths] });
            }
          }
        }
      });
    });
  },

  /**
   * 预览图片
   */
  previewImage(e) {
    const { index } = e.currentTarget.dataset;
    const { images } = this.data;
    wx.previewImage({
      urls: images,
      current: images[index]
    });
  },

  /**
   * 删除图片
   */
  deleteImage(e) {
    const { index } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除图片',
      content: '确认删除这张图片？',
      success: (res) => {
        if (res.confirm) {
          const images = [...this.data.images];
          images.splice(index, 1);
          this.setData({ images });
        }
      }
    });
  },

  /**
   * 删除视频
   */
  deleteVideo(e) {
    const { index } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除视频',
      content: '确认删除这段视频？',
      success: (res) => {
        if (res.confirm) {
          const videos = [...this.data.videos];
          videos.splice(index, 1);
          this.setData({ videos });
        }
      }
    });
  },

  /**
   * 保存日记
   */
  saveDiary() {
    const { date, title, content, images, videos, location, weather } = this.data;

    if (!content.trim() && !title.trim() && images.length === 0 && videos.length === 0) {
      wx.showToast({ title: '日记内容不能为空', icon: 'none' });
      return;
    }

    this.setData({ isSaving: true });

    const now = new Date();
    const diary = {
      id: util.generateId(),
      date,
      title: title.trim(),
      content: content.trim(),
      images,
      videos,
      location,
      weather,
      createdAt: util.formatDateTime(now),
      updatedAt: util.formatDateTime(now)
    };

    // 如果是编辑模式，保留原 id 和 createdAt
    const existing = storage.getDiaryByDate(date);
    if (existing) {
      diary.id = existing.id;
      diary.createdAt = existing.createdAt;
    }

    try {
      storage.saveDiary(diary);
      this.setData({ isSaving: false });
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 800);
    } catch (err) {
      this.setData({ isSaving: false });
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  /**
   * 放弃并返回
   */
  onBack() {
    wx.showModal({
      title: '提示',
      content: '确认放弃本次编辑？',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack();
        }
      }
    });
  }
});
