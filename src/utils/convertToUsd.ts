export const convertToUSD = async (amount: number, currency: string): Promise<number> => {
    if (currency === "USD") return amount;

    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`);
    const data = await response.json();
    const rate = data.rates["USD"];
    return amount * rate;
};