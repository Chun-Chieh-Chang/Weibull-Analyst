import React from 'react';
import { BookOpenIcon } from '@heroicons/react/24/outline';
import { Language } from '../types';
import { t } from '../utils/locales';

interface SectionProps {
  title: string;
  children?: React.ReactNode;
}

const Section = ({ title, children }: SectionProps) => (
  <div className="mb-8 last:mb-0">
    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700 pb-2 mb-4">
      {title}
    </h3>
    <div className="text-base text-slate-600 dark:text-slate-400 leading-relaxed space-y-4">
      {children}
    </div>
  </div>
);

interface Props {
  lang: Language;
}

const TheoreticalGuide: React.FC<Props> = ({ lang }) => {
  const isZh = lang === 'zh';

  return (
    <div className="h-full overflow-y-auto p-5 bg-white dark:bg-slate-800 transition-colors">
      <div className="flex items-center space-x-2 mb-6 text-indigo-700 dark:text-indigo-400">
        <BookOpenIcon className="w-6 h-6" />
        <h2 className="text-lg font-bold">{t('guide.title', lang)}</h2>
      </div>

      <Section title={isZh ? "韋伯方程" : "The Weibull Equation"}>
        <p>
          {isZh
            ? "產品隨時間 t 的可靠度由雙參數韋伯可靠度函數建模："
            : "The reliability of a product over time t is modeled by the 2-parameter Weibull reliability function:"}
        </p>
        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-700 text-center font-mono my-2 text-slate-800 dark:text-slate-200">
          R(t) = e<sup>-(t/η)<sup>β</sup></sup>
        </div>
        <p>
          {isZh ? "其中：" : "Where:"}
          <br />
          <strong>R(t)</strong> = {isZh ? "可靠度 (時間 t 的存活機率)" : "Reliability (probability of survival) at time t."}
          <br />
          <strong>β (Beta)</strong> = {isZh ? "形狀參數" : "Shape Parameter."}
          <br />
          <strong>η (Eta)</strong> = {isZh ? "尺度參數" : "Scale Parameter."}
        </p>
      </Section>

      <Section title={isZh ? "1. 形狀參數 (β)" : "1. The Shape Parameter (β)"}>
        <p>
          {isZh
            ? "Beta (β) 是機率圖上回歸線的斜率。它是一個無量綱參數，決定了分佈的形狀並指示失效模式的物理機制。"
            : "Beta (β) is the slope of the regression line on the probability plot. It is a dimensionless parameter that dictates the shape of the distribution and indicates the physics of the failure mode."}
        </p>
        <ul className="space-y-3 mt-2">
          <li className="flex items-start bg-indigo-50/30 dark:bg-indigo-900/20 p-2 rounded">
            <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 w-20 shrink-0 mt-0.5">β &lt; 1.0</div>
            <div>
              <strong className="text-slate-800 dark:text-slate-200 block mb-1">{isZh ? "早夭期 (失效率遞減)" : "Infant Mortality (Decreasing Failure Rate)"}</strong>
              {isZh
                ? "失效通常由「早期」缺陷引起，如製造瑕疵、品質控制不良或安裝錯誤。隨著弱小單元的失效與剔除，群體隨時間推移變得更強健。"
                : "Failures are caused by 'early' defects such as manufacturing flaws, poor quality control, contamination, or installation errors. The population effectively gets stronger over time as the weak units fail and are removed."}
            </div>
          </li>
          <li className="flex items-start bg-indigo-50/30 dark:bg-indigo-900/20 p-2 rounded">
            <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 w-20 shrink-0 mt-0.5">β ≈ 1.0</div>
            <div>
              <strong className="text-slate-800 dark:text-slate-200 block mb-1">{isZh ? "隨機失效 (失效率恆定)" : "Random Failures (Constant Failure Rate)"}</strong>
              {isZh
                ? "失效與時間無關。組件處於「使用壽命」階段。失效通常源於隨機的外部應力（衝擊、事故）而非內部退化。這等同於指數分佈。"
                : "Failures are independent of time. The component is in its 'useful life' phase. Failures typically result from random external stress events (shocks, accidents) rather than internal degradation. This is equivalent to the Exponential Distribution."}
            </div>
          </li>
          <li className="flex items-start bg-indigo-50/30 dark:bg-indigo-900/20 p-2 rounded">
            <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 w-20 shrink-0 mt-0.5">β &gt; 1.0</div>
            <div>
              <strong className="text-slate-800 dark:text-slate-200 block mb-1">{isZh ? "耗損期 (失效率遞增)" : "Wear-out (Increasing Failure Rate)"}</strong>
              {isZh
                ? "失效由老化機制引起，如機械疲勞、腐蝕、磨損或化學降解。組件使用時間越長，失效機率越高。"
                : "Failures are caused by aging mechanisms such as mechanical fatigue, corrosion, erosion, or chemical degradation. The probability of failure increases the longer the component is in service."}
            </div>
          </li>
        </ul>
      </Section>

      <Section title={isZh ? "2. 尺度參數 (η)" : "2. The Scale Parameter (η)"}>
        <p>
          {isZh
            ? "Eta (η)，稱為特徵壽命，代表分佈的時間尺度。在數學上，它是可靠度函數指數為 -1 時的時間 t。"
            : "Eta (η), known as the Characteristic Life, represents the time scale of the distribution. Mathematically, it is the time t at which the exponent in the reliability function is -1."}
        </p>
        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-mono my-3 text-center text-slate-600 dark:text-slate-400 shadow-inner">
          When t = η, &nbsp; R(η) = e<sup>-1</sup> ≈ 0.368
        </div>
        <p>
          <strong>{isZh ? "解釋：" : "Interpretation:"}</strong> {isZh
            ? "這意味著在時間 t = η 時，預期正好有 63.2% 的群體已經失效（不靠度 F(t) = 0.632），無論 Beta 值為何。"
            : "This means that at time t = η, exactly 63.2% of the population is expected to have failed (Unreliability F(t) = 0.632), regardless of the Beta value."}
        </p>
        <p>
          {isZh
            ? "與平均故障時間 (MTTF) 不同，Eta 是一個穩定的錨點，不隨 Beta 變化。它允許工程師直接比較不同設計的耐久性。如果設計 A 的 Eta 高於設計 B，假設 Beta 相似，則 A 通常具有更長的特徵壽命。"
            : "Unlike 'Mean Time To Failure' (MTTF), which varies based on the shape of the curve (Beta), Eta is a stable anchor point. It allows engineers to compare the durability or 'life' of different designs directly. If Design A has a higher Eta than Design B, it generally has a longer characteristic life, assuming similar Beta values."}
        </p>
      </Section>

      <Section title={isZh ? "3. 適配度 (R²)" : "3. Goodness of Fit (R²)"}>
        <p>
          <strong className="text-slate-800 dark:text-slate-200">{isZh ? "R-Squared (決定係數)" : "R-Squared (Coefficient of Determination)"}</strong> {isZh ? "衡量數據點在機率圖上的線性程度。" : "measures the linearity of the data points on the probability plot."}
        </p>
        <ul className="list-disc list-inside pl-1 space-y-1 mt-2">
          <li><span className="text-emerald-600 dark:text-emerald-400 font-bold">&gt; 0.95</span>: {isZh ? "適配極佳。數據緊密遵循韋伯模型。" : "Excellent fit. The data closely follows the Weibull model."}</li>
          <li><span className="text-amber-600 dark:text-amber-400 font-bold">0.90 - 0.95</span>: {isZh ? "可接受（對於小樣本）。" : "Acceptable for small sample sizes."}</li>
          <li><span className="text-red-600 dark:text-red-400 font-bold">&lt; 0.90</span>: {isZh ? "適配不佳。數據可能屬於不同的分佈（如對數常態）或代表混合失效模式。" : "Poor fit. The data may belong to a different distribution (e.g., Lognormal) or represent mixed failure modes (multifurcating data)."}</li>
        </ul>
      </Section>

      <Section title={isZh ? "4. 暫緩數據 (Censored Data)" : "4. Suspensions (Censored Data)"}>
        <p>
          {isZh
            ? "暫緩（Suspension）是指尚未失效的單元（例如仍在運行中）或因非失效原因從測試中移除的單元。"
            : "A Suspension is a unit that has not failed yet (e.g., still running) or was removed from the test for non-failure reasons."}
        </p>
        <p className="mt-2">
          {isZh
            ? "本工具使用「秩調整」(Rank Adjustment) 來處理暫緩數據。暫緩單元不會顯示為圖上的點，但它們會通過推高後續失效的「順序號」來影響計算。這正確地增加了倖存群體的估計可靠度，因為我們知道這些單元至少存活到了暫緩時間。"
            : "This tool uses Rank Adjustment to account for suspensions. Suspended units do not appear as points on the plot, but they influence the calculation by pushing the 'Order Number' of subsequent failures higher. This correctly increases the estimated reliability of the surviving population, as we know these units survived at least until the suspension time."}
        </p>
      </Section>

      <Section title={isZh ? "5. 統計解釋與浴缸曲線" : "5. Statistical Interpretation & The Bathtub Curve"}>
        <p>
          {isZh
            ? "韋伯分佈之所以強大，是因為它可以用單一函數模擬浴缸曲線的三個不同階段。"
            : "The Weibull distribution is powerful because it can model the three distinct phases of the Bathtub Curve using a single function."}
        </p>
        <div className="space-y-4 mt-4">
          <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="font-bold text-slate-700 dark:text-slate-300 mb-2 text-sm uppercase tracking-wide">{isZh ? "階段 1: 早期失效 (β < 1)" : "Phase 1: Early Life (β < 1)"}</div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isZh
                ? "機率密度函數 (PDF) 呈 J 形。它從高處開始迅速下降，表明大多數有缺陷的單元會立即失效。"
                : "The Probability Density Function (PDF) is J-shaped. It starts high and drops rapidly, indicating that most defective units fail immediately."}
              <br /><span className="text-indigo-600 dark:text-indigo-400 mt-2 block font-bold">{isZh ? "策略: 預燒 / 篩選" : "Strategy: Burn-in / Screening"}</span>
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="font-bold text-slate-700 dark:text-slate-300 mb-2 text-sm uppercase tracking-wide">{isZh ? "階段 2: 使用壽命 (β ≈ 1)" : "Phase 2: Useful Life (β ≈ 1)"}</div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isZh
                ? "PDF 是指數型的。失效是隨機且「無記憶」的。"
                : "The PDF is Exponential. Failures are random and 'memoryless'."}
              <br /><span className="text-indigo-600 dark:text-indigo-400 mt-2 block font-bold">{isZh ? "策略: 備件管理" : "Strategy: Spares Management"}</span>
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="font-bold text-slate-700 dark:text-slate-300 mb-2 text-sm uppercase tracking-wide">{isZh ? "階段 3: 耗損期 (β > 1)" : "Phase 3: Wear-out (β > 1)"}</div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isZh
                ? "PDF 是鐘形的（峰值）。失效集中在 Eta 附近。Beta 越高，峰值越窄，失效時間越可預測。"
                : "The PDF is Bell-shaped (peaked). Failures cluster around Eta. The higher the Beta, the narrower the peak and the more predictable the failure time."}
              <br /><span className="text-indigo-600 dark:text-indigo-400 mt-2 block font-bold">{isZh ? "策略: 定期更換" : "Strategy: Scheduled Replacement"}</span>
            </p>
          </div>
        </div>
      </Section>

      <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400 italic text-center">
        {t('guide.ref', lang)}
      </div>
    </div>
  );
};

export default TheoreticalGuide;