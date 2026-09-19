/*
 * ふるさと納税の控除上限額(概算)計算ロジック。DOM・windowの状態には触れない純粋関数のみで構成する。
 * takehome-calculatorの税額計算ロジックを土台にしている。
 */

// どの年の税金か: 令和8年(2026年)分の所得税と、その所得にかかる令和9年度の住民税。
// 令和8年度税制改正(基礎控除・給与所得控除の引上げ)を反映している。
// 出典: 国税庁 No.1410 給与所得控除・No.1199 基礎控除、財務省「令和8年度税制改正の大綱」

// 給与所得控除(令和8年分・令和9年分、takehome-calculatorと共通)。最低保障額は本則69万円＋令和8・9年の特例5万円＝74万円。
// 住民税も令和9年度分・令和10年度分は同じ74万円(大綱の地方税(1))。
// ※ 収入660万円未満は本来「所得税法別表第五」の4,000円刻みの表を使うが、概算なので式で計算する
function salaryIncomeDeduction(income) {
  if (income <= 2200000) return Math.min(income, 740000);
  if (income <= 3600000) return income * 0.3 + 80000;
  if (income <= 6600000) return income * 0.2 + 440000;
  if (income <= 8500000) return income * 0.1 + 1100000;
  return 1950000;
}

// 所得税の基礎控除(令和8年分・令和9年分)。本人の合計所得金額で変わる。
// 本則62万円に、合計所得489万円以下は42万円・489万円超655万円以下は5万円を加算する特例。
function incomeTaxBasicDeduction(totalIncome) {
  if (totalIncome <= 4890000) return 1040000;
  if (totalIncome <= 6550000) return 670000;
  if (totalIncome <= 23500000) return 620000;
  if (totalIncome <= 24000000) return 480000;
  if (totalIncome <= 24500000) return 320000;
  if (totalIncome <= 25000000) return 160000;
  return 0;
}

// 住民税の基礎控除。所得税と違って引き上げられておらず、43万円のまま。
function residentTaxBasicDeduction(totalIncome) {
  if (totalIncome <= 24000000) return 430000;
  if (totalIncome <= 24500000) return 290000;
  if (totalIncome <= 25000000) return 150000;
  return 0;
}

// 所得税の超過累進税率表(平成27年分以後。令和8年分も同じ。takehome-calculatorと共通)
const INCOME_TAX_BRACKETS = [
  { limit: 1950000, rate: 0.05 },
  { limit: 3300000, rate: 0.1 },
  { limit: 6950000, rate: 0.2 },
  { limit: 9000000, rate: 0.23 },
  { limit: 18000000, rate: 0.33 },
  { limit: 40000000, rate: 0.4 },
  { limit: Infinity, rate: 0.45 },
];

function marginalIncomeTaxRate(taxableIncome) {
  if (taxableIncome <= 0) return 0;
  const bracket = INCOME_TAX_BRACKETS.find((b) => taxableIncome <= b.limit);
  return bracket.rate;
}

// 控除上限額 = 住民税所得割額×20% ÷ (90% − 所得税率×1.021) + 2,000円(ワンストップ特例を使わない場合の目安式)
function donationLimitFromResidentTax(residentTaxIncomeBased, marginalRate) {
  if (residentTaxIncomeBased <= 0) return 0;
  const effectiveMarginalRate = marginalRate * 1.021; // 復興特別所得税を加味
  const denominator = 0.9 - effectiveMarginalRate;
  return Math.floor((residentTaxIncomeBased * 0.2) / denominator) + 2000;
}

function calcEmployee(input) {
  const { grossIncome, age40to64, dependents } = input;

  const healthRate = 0.0499;
  const careRate = age40to64 ? 0.008 : 0;
  const pensionRate = 0.0915;
  const employmentRate = 0.006;
  const socialInsurance = Math.round(grossIncome * (healthRate + careRate + pensionRate + employmentRate));

  const salaryDeduction = salaryIncomeDeduction(grossIncome);
  const employmentIncome = Math.max(0, grossIncome - salaryDeduction); // 給与所得＝合計所得金額(基礎控除の判定に使う)

  const basicDeductionResidentTax = residentTaxBasicDeduction(employmentIncome);
  const dependentDeductionResidentTax = dependents * 330000;
  const taxableIncomeForResidentTax = Math.max(
    0,
    employmentIncome - socialInsurance - basicDeductionResidentTax - dependentDeductionResidentTax
  );
  const residentTaxIncomeBased = Math.round(taxableIncomeForResidentTax * 0.1);

  const basicDeductionIncomeTax = incomeTaxBasicDeduction(employmentIncome);
  const dependentDeductionIncomeTax = dependents * 380000;
  const taxableIncomeForIncomeTax = Math.max(
    0,
    employmentIncome - socialInsurance - basicDeductionIncomeTax - dependentDeductionIncomeTax
  );
  const marginalRate = marginalIncomeTaxRate(taxableIncomeForIncomeTax);

  const donationLimit = donationLimitFromResidentTax(residentTaxIncomeBased, marginalRate);

  return { grossIncome, residentTaxIncomeBased, marginalRate, donationLimit };
}

function calcSelfEmployed(input) {
  const { grossIncome, expenseRate, dependents } = input;

  const expenses = Math.round(grossIncome * expenseRate);
  const blueReturnDeduction = 650000;
  const businessIncome = Math.max(0, grossIncome - expenses - blueReturnDeduction);

  const nationalPension = 204000;
  const nationalHealthInsuranceCap = 1060000;
  const nationalHealthInsurance = Math.min(nationalHealthInsuranceCap, Math.round(businessIncome * 0.1));
  const socialInsurance = nationalPension + nationalHealthInsurance;

  const basicDeductionResidentTax = residentTaxBasicDeduction(businessIncome); // 事業所得＝合計所得金額
  const dependentDeductionResidentTax = dependents * 330000;
  const taxableIncomeForResidentTax = Math.max(
    0,
    businessIncome - socialInsurance - basicDeductionResidentTax - dependentDeductionResidentTax
  );
  const residentTaxIncomeBased = Math.round(taxableIncomeForResidentTax * 0.1);

  const basicDeductionIncomeTax = incomeTaxBasicDeduction(businessIncome);
  const dependentDeductionIncomeTax = dependents * 380000;
  const taxableIncomeForIncomeTax = Math.max(
    0,
    businessIncome - socialInsurance - basicDeductionIncomeTax - dependentDeductionIncomeTax
  );
  const marginalRate = marginalIncomeTaxRate(taxableIncomeForIncomeTax);

  const donationLimit = donationLimitFromResidentTax(residentTaxIncomeBased, marginalRate);

  return { grossIncome, residentTaxIncomeBased, marginalRate, donationLimit };
}

function calcDonationLimit(input) {
  if (input.employmentType === "self_employed") {
    return calcSelfEmployed(input);
  }
  return calcEmployee(input);
}
