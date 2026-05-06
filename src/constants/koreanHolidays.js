/**
 * 한국 공휴일 자동 생성 시스템
 */

// 고정 양력 공휴일
const FIXED_HOLIDAYS = {
  "01-01": { title: "신정" },
  "03-01": { title: "삼일절" },
  "05-05": { title: "어린이날" },
  "06-06": { title: "현충일" },
  "08-15": { title: "광복절" },
  "10-03": { title: "개천절" },
  "10-09": { title: "한글날" },
  "12-25": { title: "성탄절" },
};

/**
 * 특정 연도의 공휴일 배열 생성
 * @param {number} year - 연도 (예: 2025)
 * @returns {Array} 공휴일 객체 배열
 */
export const getKoreanHolidaysForYear = (year = new Date().getFullYear()) => {
  const holidays = [];

  // 고정 양력 공휴일 추가
  for (const [date, holiday] of Object.entries(FIXED_HOLIDAYS)) {
    const fullDate = `${year}-${date}`;
    holidays.push({
      id: `holiday-${year}-${date.replace("-", "")}`,
      title: holiday.title,
      date: fullDate,
      endDate: fullDate,
      isHoliday: true,
    });
  }

  return holidays;
};
