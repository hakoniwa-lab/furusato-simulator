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

// 所得税額(復興特別所得税を足す前)。国税庁 No.2260 所得税の税率の速算表。課税所得は1,000円未満を切り捨てる
const INCOME_TAX_DEDUCT = [0, 97500, 427500, 636000, 1536000, 2796000, 4796000];
function incomeTaxAmount(taxableIncome) {
  const t = Math.floor(Math.max(0, taxableIncome) / 1000) * 1000;
  if (t <= 0) return 0;
  const i = INCOME_TAX_BRACKETS.findIndex((b) => t <= b.limit);
  return Math.max(0, Math.floor(t * INCOME_TAX_BRACKETS[i].rate - INCOME_TAX_DEDUCT[i]));
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
  const ideco = Math.max(0, input.ideco || 0); // iDeCoの掛金(小規模企業共済等掛金控除。所得税・住民税とも全額が所得控除)

  // 料率は2026年度(令和8年度)。本人負担は労使折半の半分
  const healthRate = 0.0495; // 健康保険料(協会けんぽ全国平均9.90%の半分)
  const childSupportRate = 0.00115; // 子ども・子育て支援金(0.23%の半分。2026年4月分から健康保険料と一緒に徴収)
  const careRate = age40to64 ? 0.0081 : 0; // 介護保険料(40〜64歳。1.62%の半分)
  const pensionRate = 0.0915; // 厚生年金保険料(18.3%の半分。2017年9月から固定)
  const employmentRate = 0.005; // 雇用保険料(一般の事業の労働者負担 5/1,000)
  const socialInsurance = Math.round(grossIncome * (healthRate + childSupportRate + careRate + pensionRate + employmentRate));

  const salaryDeduction = salaryIncomeDeduction(grossIncome);
  const employmentIncome = Math.max(0, grossIncome - salaryDeduction); // 給与所得＝合計所得金額(基礎控除の判定に使う)

  const basicDeductionResidentTax = residentTaxBasicDeduction(employmentIncome);
  const dependentDeductionResidentTax = dependents * 330000;
  const taxableIncomeForResidentTax = Math.max(
    0,
    employmentIncome - socialInsurance - ideco - basicDeductionResidentTax - dependentDeductionResidentTax
  );
  const residentTaxIncomeBased = Math.round(taxableIncomeForResidentTax * 0.1);

  const basicDeductionIncomeTax = incomeTaxBasicDeduction(employmentIncome);
  const dependentDeductionIncomeTax = dependents * 380000;
  const taxableIncomeForIncomeTax = Math.max(
    0,
    employmentIncome - socialInsurance - ideco - basicDeductionIncomeTax - dependentDeductionIncomeTax
  );
  const marginalRate = marginalIncomeTaxRate(taxableIncomeForIncomeTax);

  const donationLimit = donationLimitFromResidentTax(residentTaxIncomeBased, marginalRate);

  return { grossIncome, residentTaxIncomeBased, marginalRate, donationLimit, taxableIncomeForIncomeTax };
}

function calcSelfEmployed(input) {
  const { grossIncome, expenseRate, dependents } = input;
  const ideco = Math.max(0, input.ideco || 0);

  const expenses = Math.round(grossIncome * expenseRate);
  const blueReturnDeduction = 650000;
  const businessIncome = Math.max(0, grossIncome - expenses - blueReturnDeduction);

  const nationalPension = 215040; // 2026年度 月17,920円×12か月
  const nationalHealthInsuranceCap = 1130000; // 2026年度の国保の賦課限度額(子ども・子育て支援3万円を含む)
  const nationalHealthInsurance = Math.min(nationalHealthInsuranceCap, Math.round(businessIncome * 0.1));
  const socialInsurance = nationalPension + nationalHealthInsurance;

  const basicDeductionResidentTax = residentTaxBasicDeduction(businessIncome); // 事業所得＝合計所得金額
  const dependentDeductionResidentTax = dependents * 330000;
  const taxableIncomeForResidentTax = Math.max(
    0,
    businessIncome - socialInsurance - ideco - basicDeductionResidentTax - dependentDeductionResidentTax
  );
  const residentTaxIncomeBased = Math.round(taxableIncomeForResidentTax * 0.1);

  const basicDeductionIncomeTax = incomeTaxBasicDeduction(businessIncome);
  const dependentDeductionIncomeTax = dependents * 380000;
  const taxableIncomeForIncomeTax = Math.max(
    0,
    businessIncome - socialInsurance - ideco - basicDeductionIncomeTax - dependentDeductionIncomeTax
  );
  const marginalRate = marginalIncomeTaxRate(taxableIncomeForIncomeTax);

  const donationLimit = donationLimitFromResidentTax(residentTaxIncomeBased, marginalRate);

  return { grossIncome, residentTaxIncomeBased, marginalRate, donationLimit, taxableIncomeForIncomeTax };
}

function calcDonationLimit(input) {
  const calc = input.employmentType === "self_employed" ? calcSelfEmployed : calcEmployee;
  const r = calc(input);
  // iDeCoを入れたときは、入れなかった場合の上限も並べる(掛金で上限が下がる分を見せる)
  r.ideco = Math.max(0, input.ideco || 0);
  r.limitWithoutIdeco = r.ideco > 0 ? calc(Object.assign({}, input, { ideco: 0 })).donationLimit : r.donationLimit;
  return r;
}

/*
 * 住宅ローン控除がある場合の確かめ。
 * 上限額の式は住宅ローン控除の前の所得割で計算するので上限そのものは変わらないが、住民税は
 * 調整控除→配当控除→住宅ローン控除→寄附金税額控除 の順に引くため、住宅ローン控除が大きいと
 * 寄附金の控除を引ききれないことがある(練馬区「寄附金税額控除」のよくある質問)。
 * 寄附した場合としない場合の税金の合計を、住宅ローン控除ありとなしで比べ、減り方の差を「控除しきれない額」とする。
 * opt: { credit: 住宅ローン控除の年額(控除可能額), filing: "onestop" | "return",
 *        capRate/capMax: 所得税から引ききれない分を住民税から引ける上限(課税総所得金額等×5%・最高97,500円など) }
 */
function totalTaxAfterDonation(r, opt, credit, donation) {
  const ded = Math.max(0, donation - 2000);
  const onestop = opt.filing === "onestop";
  const taxable = onestop ? r.taxableIncomeForIncomeTax : Math.max(0, r.taxableIncomeForIncomeTax - ded); // 確定申告なら寄附金控除(所得控除)
  const itBase = incomeTaxAmount(taxable);
  const loanIT = Math.min(credit, itBase);
  const loanRT = Math.min(credit - loanIT, Math.floor(taxable * opt.capRate), opt.capMax);
  const incomeTax = Math.floor((itBase - loanIT) * 1.021); // 復興特別所得税は住宅ローン控除のあとの税額にかかる
  const rate = r.marginalRate * 1.021;
  const shotoku = r.residentTaxIncomeBased;
  const afterLoan = Math.max(0, shotoku - loanRT);
  const basic = ded * 0.1;
  const special = Math.min(ded * (0.9 - rate), shotoku * 0.2);
  const shinkoku = onestop ? (special * rate) / (0.9 - rate) : 0; // ワンストップ特例の申告特例控除(所得税の分も住民税から)
  const residentTax = afterLoan - Math.min(basic + special + shinkoku, afterLoan);
  return incomeTax + residentTax;
}

function housingLoanCheck(r, opt) {
  if (!(opt.credit > 0) || r.donationLimit <= 0) return null;
  const lostFor = (o) => {
    const saved = (credit) => totalTaxAfterDonation(r, o, credit, 0) - totalTaxAfterDonation(r, o, credit, r.donationLimit);
    return Math.max(0, Math.round(saved(0) - saved(opt.credit))); // 住宅ローン控除のせいで減らなくなった税金
  };
  const taxable0 = r.taxableIncomeForIncomeTax;
  const itBase0 = incomeTaxAmount(taxable0);
  return {
    lostAtLimit: lostFor(opt),
    lostIfOnestop: opt.filing === "return" ? lostFor(Object.assign({}, opt, { filing: "onestop" })) : null,
    incomeTaxBeforeLoan: itBase0,
    loanFromIncomeTax: Math.min(opt.credit, itBase0),
    loanCapResident: Math.min(Math.floor(taxable0 * opt.capRate), opt.capMax),
  };
}
