// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract DKIMManager is Ownable {

    mapping (bytes => bytes) private allDkim;

    constructor() {}

    function upgradeDKIM(bytes memory name, bytes memory _dkim) public onlyOwner {
        allDkim[name] = _dkim;
    }

    function dkim(bytes memory name) public view returns (bytes memory) {
        return allDkim[name];
    }

}
