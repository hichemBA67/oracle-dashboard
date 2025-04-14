"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";

const proxyAbi = ["function aggregator() view returns (address)"];

const aggregatorAbi = [
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
  "event AnswerUpdated(int256 indexed current, uint256 indexed roundId, uint256 updatedAt)",
  "event NewRound(uint256 indexed roundId, address indexed startedBy, uint256 startedAt)",
];

export default function Home() {
  const [coinbasePrice, setCoinbasePrice] = useState<number | null>(null);
  const [oraclePrice, setOraclePrice] = useState<number | null>(null);
  const [oracleTime, setOracleTime] = useState<string | null>(null);
  const [priceDeviation, setPriceDeviation] = useState<string | null>(null);
  const [usdDeviation, setUsdDeviation] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket("wss://ws-feed.exchange.coinbase.com");

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "subscribe",
          channels: [{ name: "ticker", product_ids: ["BTC-USD"] }],
        })
      );
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "ticker" && data.price) {
        const price = parseFloat(data.price);
        setCoinbasePrice(price);
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    const provider = new ethers.providers.JsonRpcProvider(
      process.env.NEXT_PUBLIC_RPC_URL ||
        "https://polygon-bor-rpc.publicnode.com"
    );
    const proxyAddress =
      process.env.NEXT_PUBLIC_CHAINLINK_FEED ||
      "0xc907E116054Ad103354f2D350FD2514433D57F6f";

    const setupListener = async () => {
      const proxy = new ethers.Contract(proxyAddress, proxyAbi, provider);
      const aggregatorAddress = await proxy.aggregator();
      console.log("🔗 Aggregator address:", aggregatorAddress);

      const feed = new ethers.Contract(
        aggregatorAddress,
        aggregatorAbi,
        provider
      );

      // Initial get
      const [, answer, , updatedAt] = await feed.latestRoundData();
      const initialPrice = Number(answer) / 1e8;
      setOraclePrice(initialPrice);
      setOracleTime(new Date(Number(updatedAt) * 1000).toLocaleString());

      feed.on("AnswerUpdated", (current, roundId, updatedAt) => {
        const price = Number(current) / 1e8;
        setOraclePrice(price);
        setOracleTime(new Date(Number(updatedAt) * 1000).toLocaleString());
      });

      feed.on("NewRound", (roundId, startedBy, startedAt) => {
        console.log(
          `🔄 New Round: ${roundId} by ${startedBy} at ${new Date(
            Number(startedAt) * 1000
          ).toISOString()}`
        );
      });
    };

    setupListener();
  }, []);

  useEffect(() => {
    if (oraclePrice !== null && coinbasePrice !== null) {
      const diff = oraclePrice - coinbasePrice;
      const percent = ((diff / coinbasePrice) * 100).toFixed(2);
      setUsdDeviation(diff.toFixed(4));
      setPriceDeviation(percent);
    }
  }, [oraclePrice, coinbasePrice]);

  return (
    <main className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">
        🔗 Chainlink vs. Coinbase Price Tracker
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-xl p-4 shadow">
          <h2 className="font-semibold mb-2">🏦 Coinbase (BTC/USD)</h2>
          <p className="text-lg">
            Price: {coinbasePrice?.toFixed(4) ?? "Connecting..."} USD
          </p>
        </div>

        <div className="border rounded-xl p-4 shadow">
          <h2 className="font-semibold mb-2">🧠 Chainlink Oracle (BTC/USD)</h2>
          <p className="text-lg">
            Price: {oraclePrice?.toFixed(4) ?? "Waiting for event..."} USD
          </p>
          <p className="text-sm text-gray-600">
            Last updated: {oracleTime ?? "..."}
          </p>
          {priceDeviation && usdDeviation && (
            <>
              <p className="text-sm text-yellow-700">
                Deviation: {priceDeviation}%
              </p>
              <p className="text-sm text-yellow-700">
                Difference: {usdDeviation} USD
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
