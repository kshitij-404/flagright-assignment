export const convertToUSD = async (
  amount: number,
  currency: string
): Promise<number> => {
  if (currency === "USD") return amount;

  try {
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${currency}`
    );
    const data = await response.json();
    const rate = data.rates?.["USD"];

    if (rate === undefined) {
      console.error(
        `Exchange rate for ${currency} to USD not found. Using default rate of 1.`
      );
      throw new Error(`Exchange rate for ${currency} to USD not found.`);
    }

    return amount * rate;
  } catch (error) {
    console.error(`Failed to convert ${currency} to USD:`, error);
    return amount * 1;
  }
};
