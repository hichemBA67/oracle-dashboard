"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";

const proxyAbi = ["function aggregator() view returns (address)"];

const aggregatorAbi = [
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
  "event AnswerUpdated(int256 indexed current, uint256 indexed roundId, uint256 updatedAt)",
  "event NewRound(uint256 indexed roundId, address indexed startedBy, uint256 startedAt)",
];

const NETWORKS = [
  {
    name: "Polygon",
    wsUrl: "wss://polygon-bor-rpc.publicnode.com",
    feedAddress: "0xc907E116054Ad103354f2D350FD2514433D57F6f",
    icon: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTxKbanF0GROQOoMhvkRM1TTgh4GBQpC5vN7A&s",
  },
  {
    name: "Ethereum",
    wsUrl: "wss://mainnet.gateway.tenderly.co",
    feedAddress: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
    icon: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_D16PwojyH2cc39r34C0bsOC-dxNFDNjPdg&s",
  },
  {
    name: "Arbitrum",
    wsUrl: "wss://arbitrum-one-rpc.publicnode.com",
    feedAddress: "0x6ce185860a4963106506C203335A2910413708e9",
    icon: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRQ2_XBHt1Z4vDZ8oQGIrGJmT1xkWdVckaTuA&s",
  },
  {
    name: "BSC",
    wsUrl: "wss://bsc-rpc.publicnode.com",
    feedAddress: "0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf",
    icon: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT3iKPB6fDHgg5akGa9Fsyqpxk1NbFTNDLDfw&s",
  },
];

const coinbaseIcon =
  "https://cdn.iconscout.com/icon/free/png-256/free-coinbase-logo-icon-download-in-svg-png-gif-file-formats--web-crypro-trading-platform-logos-pack-icons-7651204.png";

export default function Home() {
  const [coinbasePrice, setCoinbasePrice] = useState<number | null>(null);
  const [oraclePrices, setOraclePrices] = useState<Record<string, number>>({});
  const [oracleTimes, setOracleTimes] = useState<Record<string, string>>({});
  const [priceDeviations, setPriceDeviations] = useState<
    Record<string, string>
  >({});
  const [usdDeviations, setUsdDeviations] = useState<Record<string, string>>(
    {}
  );

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
    if (!coinbasePrice) return;

    NETWORKS.forEach((network) => {
      const provider = new ethers.providers.WebSocketProvider(network.wsUrl);

      const fetchInitialPriceAndListen = async () => {
        const proxy = new ethers.Contract(
          network.feedAddress,
          proxyAbi,
          provider
        );
        const aggregatorAddress = await proxy.aggregator();

        const feed = new ethers.Contract(
          aggregatorAddress,
          aggregatorAbi,
          provider
        );

        const [, answer, , updatedAt] = await feed.latestRoundData();
        const initialPrice = Number(answer) / 1e8;
        setOraclePrices((prev) => ({ ...prev, [network.name]: initialPrice }));
        setOracleTimes((prev) => ({
          ...prev,
          [network.name]: new Date(Number(updatedAt) * 1000).toLocaleString(),
        }));

        feed.on("AnswerUpdated", (current, roundId, updatedAt) => {
          const price = Number(current) / 1e8;
          setOraclePrices((prev) => ({ ...prev, [network.name]: price }));
          setOracleTimes((prev) => ({
            ...prev,
            [network.name]: new Date(Number(updatedAt) * 1000).toLocaleString(),
          }));
        });
      };

      fetchInitialPriceAndListen();
    });
  }, [coinbasePrice]);

  useEffect(() => {
    if (!coinbasePrice) return;

    const newDeviations: Record<string, string> = {};
    const newUsdDiffs: Record<string, string> = {};

    for (const [network, price] of Object.entries(oraclePrices)) {
      const diff = price - coinbasePrice;
      newUsdDiffs[network] = diff.toFixed(4);
      newDeviations[network] = ((diff / coinbasePrice) * 100).toFixed(2);
    }

    setUsdDeviations(newUsdDiffs);
    setPriceDeviations(newDeviations);
  }, [oraclePrices, coinbasePrice]);

  return (
    <main className="p-8 space-y-8">
      <h1 className="text-2xl font-bold text-center mb-4">
        🔗 Chainlink vs. Coinbase Price Tracker
      </h1>

      <div className="w-full max-w-4xl mx-auto border rounded-xl p-6 shadow relative text-center">
        <img
          src={coinbaseIcon}
          alt="Coinbase"
          className="w-6 absolute top-4 left-4 rounded-full"
        />
        <h2 className="text-xl font-semibold mb-2">Coinbase (BTC/USD)</h2>
        <p className="text-3xl font-bold">
          {coinbasePrice?.toFixed(4) ?? "Connecting..."} USD
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {NETWORKS.map((network) => (
          <div
            key={network.name}
            className="border rounded-xl p-4 shadow relative"
          >
            <img
              src={network.icon}
              alt={network.name}
              className="w-6 absolute top-4 left-4 rounded-full"
            />
            <h2 className="text-md font-semibold text-center mb-2">
              {priceDeviations[network.name] ?? "..."}%
            </h2>
            <p className="text-lg text-center">
              Price: {oraclePrices[network.name]?.toFixed(4) ?? "Loading..."}{" "}
              USD
            </p>
            <p className="text-sm text-gray-600 text-center">
              Last updated: {oracleTimes[network.name] ?? "..."}
            </p>
            {priceDeviations[network.name] && usdDeviations[network.name] && (
              <div className="text-center mt-2">
                <p className="text-sm text-yellow-700">
                  Difference: {usdDeviations[network.name]} USD
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
