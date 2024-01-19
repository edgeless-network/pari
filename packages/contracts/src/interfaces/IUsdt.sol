// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.23;

interface IUsdt {
    function transfer(address to, uint256 amount) external;
    function transferFrom(address from, address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external;
    function basisPointsRate() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
}
