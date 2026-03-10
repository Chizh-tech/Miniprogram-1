const util = require('../../utils/util');
const storage = require('../../utils/storage');

Page({
  data: {
    // 当前显示的年月
    currentYear: 0,
    currentMonth: 0,
    // 月份名称
    monthName: '',
    // 日历格子数据
    calendarDays: [],
    // 当月有日记的日期集合
    diaryDates: {},
    // 选中的日期
    selectedDate: '',
    // 日记列表（当月）
    diaryList: [],
    // 视图模式：calendar | list
    viewMode: 'calendar',
    // 星期表头
    weekHeaders: ['日', '一', '二', '三', '四', '五', '六']
  },

  onLoad() {
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      selectedDate: util.formatDate(now)
    });
    this.renderCalendar();
  },

  async onShow() {
    // 每次显示页面时刷新（日记可能有增减）
    await this.renderCalendar();
    await this.loadDiaryList();
  },

  /**
   * 渲染当前月份日历
   */
  async renderCalendar() {
    const { currentYear, currentMonth } = this.data;
    const calendarDays = util.getCalendarDays(currentYear, currentMonth);
    const diaryDatesArr = await storage.getDiaryDatesInMonth(currentYear, currentMonth);

    // 转为 Set 方便查找
    const diaryDates = {};
    diaryDatesArr.forEach(d => { diaryDates[d] = true; });

    // 标记有日记的日期
    calendarDays.forEach(day => {
      if (!day.empty) {
        day.hasDiary = !!diaryDates[day.dateStr];
        day.isSelected = day.dateStr === this.data.selectedDate;
      }
    });

    const monthName = `${currentYear}年${currentMonth}月`;

    this.setData({ calendarDays, diaryDates, monthName });
  },

  /**
   * 加载日记列表（日历模式：当月；列表模式：全部）
   */
  async loadDiaryList() {
    const { currentYear, currentMonth, viewMode } = this.data;
    let list = await storage.getDiaryList();

    if (viewMode === 'calendar') {
      const prefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}-`;
      list = list.filter(d => d.date.startsWith(prefix));
    }

    // 添加展示字段
    list = list.map(d => {
      const parts = d.date.split('-');
      return Object.assign({}, d, {
        dayNum: parts[2],
        monthYear: `${parts[1]}/${parts[0]}`
      });
    });

    this.setData({ diaryList: list });
  },

  /**
   * 切换到上一个月
   */
  async prevMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth--;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear--;
    }
    this.setData({ currentYear, currentMonth, selectedDate: '' });
    await this.renderCalendar();
    await this.loadDiaryList();
  },

  /**
   * 切换到下一个月
   */
  async nextMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    this.setData({ currentYear, currentMonth, selectedDate: '' });
    await this.renderCalendar();
    await this.loadDiaryList();
  },

  /**
   * 回到今天
   */
  async goToday() {
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      selectedDate: util.formatDate(now)
    });
    await this.renderCalendar();
    await this.loadDiaryList();
  },

  /**
   * 点击日期格子
   */
  async onDayTap(e) {
    const { dateStr, empty } = e.currentTarget.dataset;
    if (empty || !dateStr) return;

    this.setData({ selectedDate: dateStr });
    await this.renderCalendar();

    const diary = await storage.getDiaryByDate(dateStr);
    if (diary) {
      // 已有日记 → 查看详情
      wx.navigateTo({
        url: `/pages/detail/detail?date=${dateStr}`
      });
    } else {
      // 无日记 → 询问是否新建
      wx.showModal({
        title: dateStr,
        content: '该日期还没有日记，是否新建？',
        confirmText: '新建',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: `/pages/edit/edit?date=${dateStr}`
            });
          }
        }
      });
    }
  },

  /**
   * 点击新建按钮（今天）
   */
  onCreateTap() {
    const today = util.formatDate(new Date());
    wx.navigateTo({
      url: `/pages/edit/edit?date=${today}`
    });
  },

  /**
   * 点击日记列表项
   */
  onDiaryItemTap(e) {
    const { date } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/detail/detail?date=${date}`
    });
  },

  /**
   * 切换视图模式
   */
  switchView(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ viewMode: mode }, () => {
      this.loadDiaryList();
    });
  }
});
