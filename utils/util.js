/**
 * 通用工具函数
 */

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm
 * @param {Date} date
 * @returns {string}
 */
function formatDateTime(date) {
  const d = date || new Date();
  const dateStr = formatDate(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}`;
}

/**
 * 解析 YYYY-MM-DD 字符串为日期对象
 * @param {string} dateStr
 * @returns {Date}
 */
function parseDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * 获取某月的所有天数信息，用于渲染日历
 * @param {number} year
 * @param {number} month - 1-indexed
 * @returns {Array}
 */
function getCalendarDays(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const totalDays = lastDay.getDate();
  // getDay() returns 0=Sunday, we want 0=Sunday as first column
  const startWeekday = firstDay.getDay();

  const days = [];

  // Fill empty cells before the first day
  for (let i = 0; i < startWeekday; i++) {
    days.push({ day: '', empty: true, dateStr: '' });
  }

  const today = formatDate(new Date());

  // Fill actual days
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({
      day: d,
      empty: false,
      dateStr,
      isToday: dateStr === today
    });
  }

  return days;
}

/**
 * 生成唯一 ID
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * 获取星期名称
 * @param {number} weekday - 0=Sunday
 * @returns {string}
 */
function getWeekdayName(weekday) {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[weekday];
}

/**
 * 格式化文件大小
 * @param {number} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

module.exports = {
  formatDate,
  formatDateTime,
  parseDate,
  getCalendarDays,
  generateId,
  getWeekdayName,
  formatFileSize
};
