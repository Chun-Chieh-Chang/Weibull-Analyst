import { Language } from '../types';

export const t = (key: string, lang: Language): string => {
  const keys = key.split('.');
  let value: any = translations[lang];
  for (const k of keys) {
    if (value && value[k]) {
      value = value[k];
    } else {
      return key;
    }
  }
  return value;
};

const translations: Record<Language, any> = {
  en: {
    app: {
      title: 'Weibull',
      titleSuffix: 'AI Analyst',
      single: 'Single',
      compare: 'Compare',
      export: 'Export',
      clear: 'Clear All',
    },
    input: {
      failureData: 'Failure Data',
      groupA: 'Group A',
      groupB: 'Group B',
      calculate: 'Calculate',
      placeholderSingle: 'e.g. 100\n120 S\n150',
      placeholderDual: 'e.g. 150\n200',
      formatInfo: 'Enter one value per line. Add "S" for suspensions (e.g. "120 S").',
    },
    chart: {
      probability: 'Probability Plot',
      reliability: 'Reliability Curve',
      pdf: 'Probability Density',
      probShort: 'Probability',
      relShort: 'Reliability',
      pdfShort: 'PDF',
      reset: 'Reset View',
      time: 'Time-to-Failure (t)',
      unreliability: 'Unreliability F(t) %',
      reliabilityAxis: 'Reliability R(t)',
      pdfAxis: 'PDF f(t)',
      tooltip: {
        rank: 'Rank',
        time: 'Time (t)',
        medianRank: 'Median Rank',
        reliability: 'Reliability R(t)',
        pdf: 'PDF f(t)',
        cdf: 'Unreliability F(t)',
        hazard: 'Hazard Rate h(t)',
      },
    },
    results: {
      tabs: {
        insights: 'Insights',
        data: 'Data',
        guide: 'Guide',
      },
      metrics: {
        shape: 'Shape (Beta)',
        scale: 'Scale (Eta)',
        mttf: 'MTTF (Mean Life)',
        r2: 'Goodness of Fit (R²)',
        infant: 'Infant Mortality',
        random: 'Random Failures',
        wearout: 'Wear-out',
        charLife: 'Characteristic Life (63.2%)',
        mttfSub: 'Average time to failure',
        poorFit: 'Caution: Poor Model Fit',
        excellentFit: 'Excellent Fit',
        r2Tooltip: 'R-Squared measures the goodness of fit. Values below 0.90 might indicate a poor model fit.',
      },
      table: {
        dataPoints: 'Data Points',
        comparative: 'Comparative',
        single: 'Single',
        time: 'Time',
        status: 'Status',
        fail: 'Fail',
        susp: 'Susp',
      },
      ai: {
        title: 'AI Reliability Analyst',
        generate: 'Generate Insights',
        analyzing: 'Analyzing...',
        reset: 'Reset Analysis',
        error: 'An error occurred.',
        awaiting: 'Awaiting Calculation',
        awaitingSub: 'Enter failure data in the left panel to begin analysis.',
        prompt: 'Generate insights based on your calculated parameters.',
      }
    },
    guide: {
      title: 'Weibull Theory Guide',
      ref: 'Reference: The New Weibull Handbook, Dr. Robert B. Abernethy',
    }
  },
  zh: {
    app: {
      title: '韋伯',
      titleSuffix: 'AI 分析工具',
      single: '單一分析',
      compare: '比較模式',
      export: '導出數據',
      clear: '清除',
    },
    input: {
      failureData: '失效數據',
      groupA: 'A 組數據',
      groupB: 'B 組數據',
      calculate: '開始計算',
      placeholderSingle: '例如: 100\n120 S\n150',
      placeholderDual: '例如: 150\n200',
      formatInfo: '每行輸入一筆數據。若為暫緩數據請加註 "S" (如 "120 S")。',
    },
    chart: {
      probability: '機率圖 (Probability Plot)',
      reliability: '可靠度曲線 (Reliability)',
      pdf: '機率密度函數 (PDF)',
      probShort: '機率圖',
      relShort: '可靠度',
      pdfShort: '密度函數',
      reset: '重置視圖',
      time: '失效時間 (t)',
      unreliability: '不靠度 F(t) %',
      reliabilityAxis: '可靠度 R(t)',
      pdfAxis: '密度 f(t)',
      tooltip: {
        rank: '秩 (Rank)',
        time: '時間 (t)',
        medianRank: '中位秩',
        reliability: '可靠度 R(t)',
        pdf: '密度 f(t)',
        cdf: '不靠度 F(t)',
        hazard: '失效率 h(t)',
      },
    },
    results: {
      tabs: {
        insights: '分析洞察',
        data: '詳細數據',
        guide: '理論指南',
      },
      metrics: {
        shape: '形狀參數 (Beta)',
        scale: '尺度參數 (Eta)',
        mttf: 'MTTF (平均壽命)',
        r2: '適配度 (R²)',
        infant: '早夭期 (Infant Mortality)',
        random: '隨機失效 (Random Failures)',
        wearout: '耗損期 (Wear-out)',
        charLife: '特徵壽命 (63.2%)',
        mttfSub: '平均失效時間',
        poorFit: '注意：模型適配度不佳',
        excellentFit: '模型適配極佳',
        r2Tooltip: 'R-Squared 衡量數據與模型的擬合程度。低於 0.90 的值可能表示模型適配不佳。',
      },
      table: {
        dataPoints: '數據點列表',
        comparative: '比較數據',
        single: '單組數據',
        time: '時間',
        status: '狀態',
        fail: '失效',
        susp: '暫緩',
      },
      ai: {
        title: 'AI 可靠度分析師',
        generate: '生成分析報告',
        analyzing: '正在分析中...',
        reset: '重置分析',
        error: '發生錯誤',
        awaiting: '等待計算',
        awaitingSub: '請在左側輸入失效數據以開始分析。',
        prompt: '根據計算出的參數生成深入見解。',
      }
    },
    guide: {
      title: '韋伯分析理論指南',
      ref: '參考文獻: The New Weibull Handbook, Dr. Robert B. Abernethy',
    }
  }
};

export default translations;