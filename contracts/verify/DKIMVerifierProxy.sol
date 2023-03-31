// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract DKIMVerifierProxy is ERC1967Proxy {

    constructor(address implementation, address _dkimManager, address _proofVerifier, address _rsaVerify) ERC1967Proxy(implementation, bytes("")) {
        _changeAdmin(msg.sender);

        Address.functionDelegateCall(implementation, abi.encodeWithSignature("initialize(address,address,address)", _dkimManager, _proofVerifier, _rsaVerify));
    }

    function getImplementation() public view returns (address) {
        return _implementation();
    }

    function upgradeDelegate(address newImplementation) public {
        require(msg.sender == _getAdmin());
        _upgradeTo(newImplementation);
    }
}
