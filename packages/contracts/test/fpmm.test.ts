import { ethers } from "hardhat";
import { randomBytes } from "ethers";
import {
  ConditionalTokens,
  WETH,
  FPMMDeterministicFactory,
  FixedProductMarketMaker,
  FixedProductMarketMaker__factory,
} from "../typechain-types";

import { Signer, ZeroHash } from "ethers";

describe("Test an end to end fixed product market maker and conditional tokens", function () {
  let creator: Signer;
  let oracle: Signer;
  let funder: Signer;
  let buyer: Signer;
  let conditionalTokens: ConditionalTokens;
  let collateralToken: WETH;
  let fpmmDeterministicFactory: FPMMDeterministicFactory;
  let fpmm: FixedProductMarketMaker;

  const questionId = randomBytes(32);
  const numOutcomes = 10;
  let conditionId: string;
  let collectionIds: string[];
  let positionIds: bigint[];

  before(async function () {
    [creator, oracle, funder, buyer] = await ethers.getSigners();
    conditionalTokens = await (
      await ethers.getContractFactory("ConditionalTokens")
    ).deploy();
    collateralToken = await (await ethers.getContractFactory("WETH")).deploy();
    fpmmDeterministicFactory = await (
      await ethers.getContractFactory("FPMMDeterministicFactory")
    ).deploy();

    conditionId = await conditionalTokens.getConditionId(
      oracle,
      questionId,
      numOutcomes
    );
    collectionIds = await Promise.all(
      Array.from({ length: numOutcomes }, (_, i) =>
        conditionalTokens.getCollectionId(ZeroHash, conditionId, 1 << i)
      )
    );

    positionIds = await Promise.all(
      collectionIds.map(async (collectionId) =>
        conditionalTokens.getPositionId(
          await collateralToken.getAddress(),
          collectionId
        )
      )
    );
  });

  describe("End to End", function () {
    const saltNonce = 2020;
    const feeFactor = (3e15).toString(); // (0.3%)
    const initialFunds = (10e18).toString();
    const initialDistribution = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const expectedFundedAmounts = initialDistribution.map((n) =>
      (1e18 * n).toString()
    );

    it("Create fixed product market maker", async function () {
      await collateralToken.deposit({ value: initialFunds, from: creator });
      await collateralToken.approve(
        await fpmmDeterministicFactory.getAddress(),
        initialFunds,
        { from: creator }
      );
      await conditionalTokens.prepareCondition(oracle, questionId, numOutcomes);

      const fpmmAddr =
        await fpmmDeterministicFactory.create2FixedProductMarketMaker.staticCall(
          saltNonce,
          await conditionalTokens.getAddress(),
          await collateralToken.getAddress(),
          [conditionId],
          feeFactor,
          initialFunds,
          initialDistribution,
          { from: creator }
        );

      fpmm = FixedProductMarketMaker__factory.connect(fpmmAddr, creator);

      await fpmmDeterministicFactory.create2FixedProductMarketMaker(
        saltNonce,
        await conditionalTokens.getAddress(),
        await collateralToken.getAddress(),
        [conditionId],
        feeFactor,
        initialFunds,
        initialDistribution,
        { from: creator }
      );
    });

    it("Fund fixed product market maker", async function () {
      await collateralToken.connect(funder).deposit({ value: initialFunds });
      await collateralToken
        .connect(funder)
        .approve(await fpmm.getAddress(), initialFunds);

      await fpmm.connect(funder).addFunding(initialFunds, []);
    });

    it("Buy from fixed product market maker", async function () {
      await collateralToken.connect(buyer).deposit({ value: initialFunds });
      await collateralToken
        .connect(buyer)
        .approve(await fpmm.getAddress(), initialFunds);

      const outcomeIndex = 5;
      const buyAMount = (1e18).toString();
      const minTokensToBuy = await fpmm.calcBuyAmount(buyAMount, outcomeIndex);
      await fpmm.connect(buyer).buy(buyAMount, outcomeIndex, minTokensToBuy);
    });

    it("close fixed product market maker", async function () {
      const outcomeIndex = 5;
      const payout = Array.from({ length: numOutcomes }, () => "0");
      payout[outcomeIndex] = (1e18).toString();
      await conditionalTokens.connect(oracle).reportPayouts(questionId, payout);
      await conditionalTokens
        .connect(buyer)
        .redeemPositions(
          await collateralToken.getAddress(),
          ZeroHash,
          conditionId,
          [1 << outcomeIndex]
        );
    });
  });
});
