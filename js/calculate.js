/*
 * ふるさと納税の控除上限額(概算)計算ロジック。DOM・windowの状態には触れない純粋関数のみで構成する。
 * takehome-calculatorの税額計算ロジックを土台にしている。
 */

// 給与所得控除(令和2年分以降の速算表、takehome-calculatorと共通)
function salaryIncomeDeduction(income) {
  if (income <= 1625000) return 550000;
  if (income <= 1800000) return income * 0.4 - 100000;
  if (income <= 3600000) return income * 0.3 + 80000;
  if (income <= 6600000) return income * 0.2 + 440000;
  if (income <= 8500000) return income * 0.1 + 1100000;
  return 1950000;
}

// 所得税の超過累進税率表(2024年分、takehome-calculatorと共通)
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

  const basicDeductionResidentTax = 430000;
  const dependentDeductionResidentTax = dependents * 330000;
  const taxableIncomeForResidentTax = Math.max(
    0,
    grossIncome - salaryDeduction - socialInsurance - basicDeductionResidentTax - dependentDeductionResidentTax
  );
  const residentTaxIncomeBased = Math.round(taxableIncomeForResidentTax * 0.1);

  const basicDeductionIncomeTax = 480000;
  const dependentDeductionIncomeTax = dependents * 380000;
  const taxableIncomeForIncomeTax = Math.max(
    0,
    grossIncome - salaryDeduction - socialInsurance - basicDeductionIncomeTax - dependentDeductionIncomeTax
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

  const basicDeductionResidentTax = 430000;
  const dependentDeductionResidentTax = dependents * 330000;
  const taxableIncomeForResidentTax = Math.max(
    0,
    businessIncome - socialInsurance - basicDeductionResidentTax - dependentDeductionResidentTax
  );
  const residentTaxIncomeBased = Math.round(taxableIncomeForResidentTax * 0.1);

  const basicDeductionIncomeTax = 480000;
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
