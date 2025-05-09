
// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

contract RouterMock {
    address public vault;
    address public usdg;
    address public weth;
    address public gov;

    constructor(address _vault, address _usdg, address _weth) public {
        vault = _vault;
        usdg = _usdg;
        weth = _weth;
        gov = msg.sender;
    }
}
