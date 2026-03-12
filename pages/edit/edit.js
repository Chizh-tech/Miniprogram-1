const util = require('../../utils/util');
const storage = require('../../utils/storage');
const weatherService = require('../../utils/weather');
const locationService = require('../../utils/location');

const OCEAN_ANIMALS = [
  { icon: '🐬', name: '海豚', tip: '保持轻盈呼吸，今天也会有惊喜。' },
  { icon: '🐢', name: '海龟', tip: '慢一点记录，回忆会更清晰。' },
  { icon: '🐠', name: '热带鱼', tip: '把今天最闪光的细节写下来。' },
  { icon: '🐙', name: '章鱼', tip: '多一点观察，故事会更立体。' },
  { icon: '🦑', name: '鱿鱼', tip: '灵感来了就先记下，不用等完美。' },
  { icon: '🦀', name: '小螃蟹', tip: '记录一个小情绪，也很重要。' },
  { icon: '🦈', name: '鲨鱼', tip: '勇敢一点，写下今天的挑战。' },
  { icon: '🐳', name: '鲸鱼', tip: '留给自己一段深呼吸的文字。' }
];

const DIVE_STATUS_OPTIONS = [
  { value: 'want', label: '想去潜水', icon: '○', className: 'status-want' },
  { value: 'depart', label: '出发潜水', icon: '▲', className: 'status-depart' },
  { value: 'diving', label: '正在潜水', icon: '●', className: 'status-diving' },
  { value: 'return', label: '潜水归来', icon: '★', className: 'status-return' }
];

Page({
  data: {
    date: '',
    dateDisplay: '',
    weekday: '',
    title: '',
    content: '',
    diveStatus: 'want',
    diveStatusOptions: DIVE_STATUS_OPTIONS,
    images: [],
    videos: [],
    imagePreviewUrls: [],
    videoPreviewUrls: [],
    location: null,
    weather: null,
    isLoadingLocation: false,
    isLoadingWeather: false,
    isExistingDiary: false,
    isSaving: false,
    showDebugPanel: false,
    showOceanAnimalPopup: false,
    randomOceanAnimal: null,
    debugInfo: {
      lastRefreshAt: '-',
      locationPermission: '未知',
      locationStatus: '未开始',
      locationError: '-',
      locationRaw: '-',
      locationResult: '-',
      locationGeocodeStatus: '-',
      locationGeocodeReason: '-',
      locationGeocodeHttp: '-',
      locationGeocodeApiStatus: '-',
      locationGeocodeApiMessage: '-',
      locationGeocodeRaw: '-',
      weatherStatus: '未开始',
      weatherError: '-',
      weatherResult: '-',
      weatherHttpStatus: '-',
      weatherApiCode: '-',
      weatherApiMessage: '-',
      weatherRaw: '-',
      hasWeatherKey: false,
      hasTencentMapKey: false
    }
  },

  async onLoad(options) {
    const date = options.date || util.formatDate(new Date());
    const dateObj = util.parseDate(date);
    const dateDisplay = `${date}  ${util.getWeekdayName(dateObj.getDay())}`;

    this.setData({
      date,
      dateDisplay,
      randomOceanAnimal: this.pickRandomOceanAnimal(),
      showOceanAnimalPopup: true,
      'debugInfo.hasWeatherKey': !!weatherService.__DEBUG_HAS_WEATHER_KEY__,
      'debugInfo.hasTencentMapKey': !!locationService.__DEBUG_HAS_MAP_KEY__
    });

    this.refreshLocationPermission();

    // 检查是否已有该日期的日记（编辑模式）
    const existing = await storage.getDiaryByDate(date);
    if (existing) {
      this.setData({
        title: existing.title || '',
        content: existing.content || '',
        diveStatus: existing.diveStatus || 'want',
        images: existing.images || [],
        videos: existing.videos || [],
        location: existing.location || null,
        weather: existing.weather || null,
        isExistingDiary: true
      });

      await this.refreshMediaPreviewUrls();

      // 历史日记缺少位置/天气信息时自动补拉一次
      if (!existing.location || !existing.weather) {
        this.autoFetchLocationAndWeather();
      }
    } else {
      // 新建模式，自动获取位置和天气
      this.setData({ imagePreviewUrls: [], videoPreviewUrls: [] });
      this.autoFetchLocationAndWeather();
    }
  },

  isCloudEnabled() {
    const app = getApp();
    return !!(wx.cloud && app && app.globalData && app.globalData.useCloudStorage);
  },

  async resolveCloudFileUrls(fileRefs) {
    if (!Array.isArray(fileRefs) || fileRefs.length === 0) {
      return [];
    }

    const cloudRefs = fileRefs.filter(ref => typeof ref === 'string' && ref.startsWith('cloud://'));
    if (cloudRefs.length === 0 || !wx.cloud) {
      return [...fileRefs];
    }

    try {
      const res = await wx.cloud.getTempFileURL({ fileList: cloudRefs });
      const map = {};
      (res.fileList || []).forEach(item => {
        if (item && item.fileID) {
          map[item.fileID] = item.tempFileURL || item.fileID;
        }
      });

      return fileRefs.map(ref => map[ref] || ref);
    } catch (err) {
      return [...fileRefs];
    }
  },

  async refreshMediaPreviewUrls() {
    const imagePreviewUrls = await this.resolveCloudFileUrls(this.data.images || []);
    const videoPreviewUrls = await this.resolveCloudFileUrls(this.data.videos || []);
    this.setData({ imagePreviewUrls, videoPreviewUrls });
  },

  onShow() {
    wx.setNavigationBarTitle({
      title: this.data.isExistingDiary ? '编辑潜水日志' : '记录潜水日志'
    });

    this.refreshLocationPermission();
  },

  toggleDebugPanel() {
    this.setData({ showDebugPanel: !this.data.showDebugPanel });
  },

  pickRandomOceanAnimal() {
    const index = Math.floor(Math.random() * OCEAN_ANIMALS.length);
    return OCEAN_ANIMALS[index];
  },

  closeOceanAnimalPopup() {
    this.setData({ showOceanAnimalPopup: false });
  },

  preventPopupClose() {},

  refreshLocationPermission() {
    wx.getSetting({
      success: (res) => {
        const auth = res && res.authSetting ? res.authSetting['scope.userLocation'] : undefined;
        const permissionText = auth === true ? '已授权' : (auth === false ? '已拒绝' : '未请求');
        this.setData({ 'debugInfo.locationPermission': permissionText });
      },
      fail: () => {
        this.setData({ 'debugInfo.locationPermission': '读取失败' });
      }
    });
  },

  /**
   * 自动获取位置和天气
   */
  autoFetchLocationAndWeather() {
    const now = util.formatDateTime(new Date());
    this.setData({
      isLoadingLocation: true,
      isLoadingWeather: true,
      'debugInfo.lastRefreshAt': now,
      'debugInfo.locationStatus': '请求中',
      'debugInfo.locationError': '-',
      'debugInfo.locationRaw': '-',
      'debugInfo.locationGeocodeStatus': '-',
      'debugInfo.locationGeocodeReason': '-',
      'debugInfo.locationGeocodeHttp': '-',
      'debugInfo.locationGeocodeApiStatus': '-',
      'debugInfo.locationGeocodeApiMessage': '-',
      'debugInfo.locationGeocodeRaw': '-',
      'debugInfo.weatherStatus': '等待定位结果',
      'debugInfo.weatherError': '-',
      'debugInfo.weatherResult': '-',
      'debugInfo.weatherHttpStatus': '-',
      'debugInfo.weatherApiCode': '-',
      'debugInfo.weatherApiMessage': '-',
      'debugInfo.weatherRaw': '-'
    });

    locationService.getCurrentLocation()
      .then(loc => {
        const geoDebug = loc && loc.geocodeDebug ? loc.geocodeDebug : {};
        this.setData({
          location: loc,
          isLoadingLocation: false,
          'debugInfo.locationStatus': '成功',
          'debugInfo.locationResult': `${loc.latitude}, ${loc.longitude} (${loc.name})`,
          'debugInfo.locationGeocodeStatus': geoDebug.ok ? '成功' : '失败',
          'debugInfo.locationGeocodeReason': geoDebug.reason || '-',
          'debugInfo.locationGeocodeHttp': geoDebug.httpStatus !== undefined ? `${geoDebug.httpStatus}` : '-',
          'debugInfo.locationGeocodeApiStatus': geoDebug.apiStatus !== undefined ? `${geoDebug.apiStatus}` : '-',
          'debugInfo.locationGeocodeApiMessage': geoDebug.apiMessage || '-',
          'debugInfo.locationGeocodeRaw': geoDebug.networkError || '-',
          'debugInfo.weatherStatus': '请求中'
        });
        // 用位置获取天气
        return weatherService.getWeather(loc.latitude, loc.longitude);
      })
      .then(weather => {
        const weatherDebug = weather && weather.debug ? weather.debug : {};
        const isWeatherFailed = !weather || weather.temperature === '--' || weatherDebug.ok === false;
        this.setData({
          weather,
          isLoadingWeather: false,
          'debugInfo.weatherStatus': isWeatherFailed ? '失败' : '成功',
          'debugInfo.weatherResult': `${weather.icon || ''} ${weather.text || ''} ${weather.temperature || '--'}°C`,
          'debugInfo.weatherHttpStatus': weatherDebug.httpStatus !== undefined ? `${weatherDebug.httpStatus}` : '-',
          'debugInfo.weatherApiCode': weatherDebug.apiCode !== undefined ? `${weatherDebug.apiCode}` : '-',
          'debugInfo.weatherApiMessage': weatherDebug.apiMessage || '-',
          'debugInfo.weatherRaw': weatherDebug.networkError || '-'
        });

        if (isWeatherFailed) {
          this.setData({ 'debugInfo.weatherError': weather.text || '天气获取失败' });
          wx.showToast({ title: weather.text || '天气获取失败', icon: 'none' });
        }
      })
      .catch((err) => {
        this.setData({
          isLoadingLocation: false,
          isLoadingWeather: false,
          'debugInfo.locationStatus': '失败',
          'debugInfo.weatherStatus': '未执行',
          'debugInfo.locationError': (err && err.message) || '定位失败',
          'debugInfo.locationRaw': (err && err.raw && err.raw.errMsg) ? err.raw.errMsg : '-'
        });
        if (err && err.type === 'AUTH_DENIED') {
          wx.showModal({
            title: '需要位置权限',
            content: '请在设置中开启“位置信息”权限后重试。',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting({
                  success: () => {
                    this.refreshLocationPermission();
                  }
                });
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
    this.refreshLocationPermission();
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

  onDiveStatusSelect(e) {
    const { value } = e.currentTarget.dataset;
    if (!value) return;
    this.setData({ diveStatus: value });
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
      success: async (res) => {
        const newImages = res.tempFiles.map(f => f.tempFilePath);
        // 云端模式上传后保存 fileID，本地模式保存到沙盒路径。
        await this.addMediaFiles(newImages, 'image');
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
      success: async (res) => {
        const tempPath = res.tempFiles[0].tempFilePath;
        await this.addMediaFiles([tempPath], 'video');
      },
      fail: () => {}
    });
  },

  /**
   * 添加媒体文件：云端模式上传为 fileID，本地模式存到本地文件。
   * @param {string[]} tempPaths
   * @param {'image'|'video'} type
   */
  async addMediaFiles(tempPaths, type) {
    if (this.isCloudEnabled()) {
      await this.uploadMediaToCloud(tempPaths, type);
      return;
    }

    this.saveFilesToLocal(tempPaths, type);
  },

  /**
   * 上传媒体到云存储并写入 fileID。
   * @param {string[]} tempPaths
   * @param {'image'|'video'} type
   */
  async uploadMediaToCloud(tempPaths, type) {
    if (!tempPaths || tempPaths.length === 0) return;

    wx.showLoading({ title: '上传中...' });
    const date = this.data.date || util.formatDate(new Date());

    try {
      const uploadTasks = tempPaths.map(async tempPath => {
        const ext = type === 'image' ? '.jpg' : '.mp4';
        const cloudPath = `diary-media/${date}/${util.generateId()}${ext}`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: tempPath
        });
        return {
          ref: uploadRes.fileID,
          previewUrl: tempPath
        };
      });

      const uploaded = await Promise.all(uploadTasks);
      const refs = uploaded.map(item => item.ref);
      const previews = uploaded.map(item => item.previewUrl);

      if (type === 'image') {
        this.setData({
          images: [...this.data.images, ...refs],
          imagePreviewUrls: [...this.data.imagePreviewUrls, ...previews]
        });
      } else {
        this.setData({
          videos: [...this.data.videos, ...refs],
          videoPreviewUrls: [...this.data.videoPreviewUrls, ...previews]
        });
      }
    } catch (err) {
      wx.showToast({ title: '上传失败，请重试', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
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
              this.setData({
                images: [...this.data.images, ...savedPaths],
                imagePreviewUrls: [...this.data.imagePreviewUrls, ...savedPaths]
              });
            } else {
              this.setData({
                videos: [...this.data.videos, ...savedPaths],
                videoPreviewUrls: [...this.data.videoPreviewUrls, ...savedPaths]
              });
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
              this.setData({
                images: [...this.data.images, ...savedPaths],
                imagePreviewUrls: [...this.data.imagePreviewUrls, ...savedPaths]
              });
            } else {
              this.setData({
                videos: [...this.data.videos, ...savedPaths],
                videoPreviewUrls: [...this.data.videoPreviewUrls, ...savedPaths]
              });
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
    const { imagePreviewUrls } = this.data;
    wx.previewImage({
      urls: imagePreviewUrls,
      current: imagePreviewUrls[index]
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
          const imagePreviewUrls = [...this.data.imagePreviewUrls];
          images.splice(index, 1);
          imagePreviewUrls.splice(index, 1);
          this.setData({ images, imagePreviewUrls });
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
          const videoPreviewUrls = [...this.data.videoPreviewUrls];
          videos.splice(index, 1);
          videoPreviewUrls.splice(index, 1);
          this.setData({ videos, videoPreviewUrls });
        }
      }
    });
  },

  /**
   * 保存日记
   */
  async saveDiary() {
    const { date, title, content, diveStatus, images, videos, location, weather } = this.data;

    if (!content.trim() && !title.trim() && images.length === 0 && videos.length === 0) {
      wx.showToast({ title: '还没记录潜水内容', icon: 'none' });
      return;
    }

    this.setData({ isSaving: true });

    const now = new Date();
    const diary = {
      id: util.generateId(),
      date,
      title: title.trim(),
      content: content.trim(),
      diveStatus: diveStatus || 'want',
      images,
      videos,
      location,
      weather,
      createdAt: util.formatDateTime(now),
      updatedAt: util.formatDateTime(now)
    };

    // 如果是编辑模式，保留原 id 和 createdAt
    const existing = await storage.getDiaryByDate(date);
    if (existing) {
      diary.id = existing.id;
      diary.createdAt = existing.createdAt;
    }

    try {
      await storage.saveDiary(diary);
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
