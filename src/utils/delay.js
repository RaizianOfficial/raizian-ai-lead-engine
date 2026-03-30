const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const randomDelay = async (minSeconds, maxSeconds) => {
    const ms = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) * 1000;
    console.log(`[Anti-Ban] Pausing for ${ms / 1000} seconds...`);
    await delay(ms);
};

module.exports = {
    delay,
    randomDelay
};
