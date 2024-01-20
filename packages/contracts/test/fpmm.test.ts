import { ethers } from "hardhat";
import { randomBytes } from "ethers";
import {
  ConditionalTokens,
  WETH,
  FPMMDeterministicFactory,
} from "../typechain-types";

import { Signer, ZeroHash } from "ethers";

describe("Test an end to end fixed product market maker and conditional tokens", function () {
  let creator: Signer;
  let oracle: Signer;
  let conditionalTokens: ConditionalTokens;
  let collateralToken: WETH;
  let fpmmDeterministicFactory: FPMMDeterministicFactory;

  const questionId = randomBytes(32);
  const numOutcomes = 10;
  let conditionId: string;
  let collectionIds: string[];
  let positionIds: bigint[];

  beforeEach(async function () {
    [creator, oracle] = await ethers.getSigners();
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
      const tx = await fpmmDeterministicFactory.create2FixedProductMarketMaker(
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
  });
});
