const CURRENCY = "INR";

export const money = (n) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: CURRENCY,
        minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
        maximumFractionDigits: 2,
    }).format(n);

export const moneyExact = (n) => {
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: CURRENCY,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(n);
}

export const moneyFromPaise = (paise) => moneyExact(paise / 100);