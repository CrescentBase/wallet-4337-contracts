import { expect } from 'chai'
import { ethers } from 'hardhat'

import web3 from 'web3'

import { fillAndSign, fillUserOp } from './UserOp'

import { BigNumber, Wallet } from 'ethers'


import {
    AddressZero,
    tohex,
    fund,
    getBalance,
    getTokenBalance, rethrow,
    checkForGeth, calcGasUsage, deployEntryPoint, checkForBannedOps, createAddress, ONE_ETH,
    shaHashHex
  } from './testutils'

import { BytesLike, parseEther, arrayify, hexConcat } from 'ethers/lib/utils'



import {
    DKIMManager,
    SolRsaVerify,
    Verifier,
    DKIMVerifier,
    DKIMVerifierProxy,
    CrescentWallet,
    CrescentWalletController,
    EntryPoint,
    EntryPointController,
    CrescentWalletProxy,
    CrescentPaymaster,
    CrescentPaymasterProxy,
    CrescentWalletProxy__factory,
    CrescentWallet__factory,
    CrescentPaymasterProxy__factory,
    CrescentPaymaster__factory,
    DKIMVerifier__factory
  } from '../typechain'
import { isHexString, toAscii } from 'ethereumjs-util'
import { Create2Factory_EIP2470 } from '../src/Create2Factory_EIP2470'

function WalletConstructor (entryPointController: string, walletController: string, dkimVerifierProxy: string, hmua: string): BytesLike {
    return new CrescentWalletProxy__factory(ethers.provider.getSigner()).getDeployTransaction(entryPointController, walletController, dkimVerifierProxy, hmua).data!
}


describe('test CerscentWallet', function () {
    const ethersSigner = ethers.provider.getSigner()
    let dkimManager: DKIMManager;
    let proofVerifier: Verifier;
    let rsaVerify: SolRsaVerify;
    let dkimVerifier: DKIMVerifier;
    let dkimVerifierFactory: DKIMVerifier__factory;
    let dkimVerifierProxy: DKIMVerifierProxy;

    let wallet: CrescentWallet;
    let walletController: CrescentWalletController;
    let walletProxy: CrescentWalletProxy;
    let paymaster: CrescentPaymaster;
    let paymasterProxy: CrescentPaymasterProxy;

    let walletProxyFactory: CrescentWalletProxy__factory;
    let walletFactory: CrescentWallet__factory;
    let paymasterProxyFactory: CrescentPaymasterProxy__factory;
    let paymasterFactory: CrescentPaymaster__factory;


    let entryPointController: EntryPointController;
    let entryPoint: EntryPoint

    const globalUnstakeDelaySec = 2
    const paymasterStake = ethers.utils.parseEther('2')
    let prefundAccountAddress: string;

    const ds = tohex("s110527._domainkey.163.com");
    const _dkim = "0xA9F49A52EC4391363C089ED5C8235EE626EC286FE849A15987AF68761CFA5213B418821F35E641DD602E096F15E070FD26359398DD1D5593A7540D1F0D4222FEC41F5F44D5854B7E93ABB0B33C4FD423FF8FC5684FCCF9EF001AF881B41CADEB3C79EF5C80430F143A5C9383BB50B3493711F4D3739F7268752BEC431B2A8F59".toLowerCase();

    const email = "hlbt_bt@163.com";
    const salt = "0xcAB951f0a00AE1aa041d5497FaEefD51191bBab1dAa49f6aCCBE91Bed4bD61b5";

    const testPrivateKey = "31f7ec9b31201c406bb0e31415c66efc720be55f54f105b74658f79f6827c17b";
    const testPublicKey = "0x5a26db057de3d243686c0ddd09599aa6a8aac9d4";
    let testWalletOwner: Wallet;

    let initCode: BytesLike;
    let preAddr: string;
    let hmua: string;

    before(async function () {
        testWalletOwner = new ethers.Wallet(testPrivateKey, ethers.provider);
        
        prefundAccountAddress = await ethersSigner.getAddress();

        hmua = shaHashHex(email + salt.substring(2));

        let factory = await ethers.getContractFactory("DKIMManager");
        dkimManager = await factory.deploy();

        let proofVerifierFactory = await ethers.getContractFactory("Verifier");
        proofVerifier = await proofVerifierFactory.deploy();

        let rsaVerifierFactory = await ethers.getContractFactory("SolRsaVerify");
        rsaVerify = await rsaVerifierFactory.deploy();

        dkimVerifierFactory = await ethers.getContractFactory("DKIMVerifier");
        dkimVerifier = await dkimVerifierFactory.deploy();

        let dkimVerifierProxyFactory = await ethers.getContractFactory("DKIMVerifierProxy");
        dkimVerifierProxy = await dkimVerifierProxyFactory.deploy(dkimVerifier.address, dkimManager.address, proofVerifier.address, rsaVerify.address);


        let create2Factory = new Create2Factory_EIP2470(ethers.provider, ethersSigner);
        await create2Factory.deployFactory();

        walletFactory = await ethers.getContractFactory("CrescentWallet");
        wallet = await walletFactory.deploy();

        let controllerFactory = await ethers.getContractFactory("CrescentWalletController");
        walletController = await controllerFactory.deploy(wallet.address);

        entryPoint = await deployEntryPoint();

        let entryPointControllerFactory = await ethers.getContractFactory("EntryPointController");
        entryPointController = await entryPointControllerFactory.deploy();

        walletProxyFactory = await ethers.getContractFactory("CrescentWalletProxy");
        walletProxy = await walletProxyFactory.deploy(entryPointController.address, walletController.address, dkimVerifierProxy.address, "0x0000000000000000000000000000000000000000000000000000000000000000");


        paymasterFactory = await ethers.getContractFactory("CrescentPaymaster");
        paymaster = await paymasterFactory.deploy();


        paymasterProxyFactory = await ethers.getContractFactory("CrescentPaymasterProxy");
        paymasterProxy = await paymasterProxyFactory.deploy(paymaster.address, Create2Factory_EIP2470.contractAddress, entryPointController.address, walletController.address, dkimVerifierProxy.address);

        initCode = WalletConstructor(entryPointController.address, walletController.address, dkimVerifierProxy.address, hmua);
        // console.log("wallet initcode:", initCode);
        initCode = await create2Factory.getDeployTransactionCallData(initCode);
        initCode = hexConcat([Create2Factory_EIP2470.contractAddress, initCode]);

        // console.log("initCode", initCode);
        preAddr = await entryPoint.callStatic.getSenderAddress(initCode).catch(e => e.errorArgs.sender);

    })


    it("CerscentWallet DKIMManager", async () => {
        await dkimManager.upgradeDKIM(ds, _dkim);
        expect(await dkimManager.dkim(ds)).to.equal(_dkim);
    })

    it("CerscentWallet check entryPoint", async function name() {
      await (await entryPointController.setEntryPoint(entryPoint.address)).wait();

      expect((await walletFactory.attach(walletProxy.address).entryPoint()).toLowerCase(), 'wallet entryPoint').to.equal(entryPoint.address.toLowerCase());

      expect((await paymasterFactory.attach(paymasterProxy.address).entryPoint()).toLowerCase(), 'paymaster entryPoint').to.equal(entryPoint.address.toLowerCase());
    })

    it("CerscentWallet walletProxy", async function name() {
      expect(await walletProxy.getAutoUpdateImplementation()).to.equal(false);
      // await walletProxy.setAutoUpdateImplementation(true);
      expect(await walletProxy.getImplementation(), "getImplementation").to.equal(wallet.address);
    })

    it("CerscentWallet Paymaster", async function name() {
      const paymaster = paymasterFactory.attach(paymasterProxy.address);
      expect(await paymaster.verifyingSigner(), "verifyingSigner").to.equal(prefundAccountAddress);

      expect(await paymaster.entryPointController(), "entryPointController").to.equal(entryPointController.address);

      expect(await paymaster.walletController(), "walletController").to.equal(walletController.address);

      expect(await paymaster.dkimVerifier(), "dkimVerifier").to.equal(dkimVerifierProxy.address);

      // console.log('getCrescentWalletProxy:', await paymaster.getCrescentWalletProxy());
    })


    it("CerscentWallet dkimVerifier", async function name() {
      const dkimVerifier = dkimVerifierFactory.attach(dkimVerifierProxy.address);
      expect(await dkimVerifier.dkimManager(), "dkimManager").to.equal(dkimManager.address);

      expect(await dkimVerifier.proofVerifier(), "dkimVerifier").to.equal(proofVerifier.address);

      expect(await dkimVerifier.rsaVerify(), "rsaVerifier").to.equal(rsaVerify.address);

    })

    
    it("CerscentWallet create sender", async function name() {
        const a: [string, string] = [
          '0x277e0e70491b974f0d22b6c372acaa2602167fc7eb1683adf7ff6bb386b65e0f',
          '0x009c63cb06bcf766efff99738cd841b40b1ba7534e00c03cb157562d2f4149bc'
        ];
        const b: [[string, string], [string, string]] = [
            [
              '0x0b08fc6be29e1d4e38413dddf2cb1974adb24de8e5f3111b9f4a1f8d3bad9c65',
              '0x0a8c01bdf4b2ea449ff96e34b7b1e6e475bc623d681c8d74e807e3a86b1d9f69'
            ],
            [
              '0x2132887ecf8c26672f49aca26a2b743bf4659fcb3c253a92c74e73fc1d959839',
              '0x2e3acf00aa34b6352e220d7fb4dc1f288a956091b6d931043339d3cc032c7598'
            ]
          ];
        const c: [string, string] = [
            '0x161b204086f4c53a247e6d8406a42d645cd74fa7ea049180f9297a2b5dbd1da3',
            '0x2efabedb73c30b9701bb036271266b947ad495ff7acde0154ed0558468f99847'
          ];
        const msg = `from:PPYang <hlbt_bt@163.com>\r\ncontent-type:multipart/alternative; boundary="Apple-Mail=_4FC58AE1-1B6B-447A-A148-F8A2941E0CD1"\r\nmime-version:1.0 (Mac OS X Mail 16.0 \\(3696.120.41.1.1\\))\r\nsubject:testCerscent3\r\nmessage-id:<AE485E95-E671-416D-A726-75397D2AA20B@163.com>\r\ndate:Mon, 27 Feb 2023 11:18:49 +0800\r\ndkim-signature:v=1; a=rsa-sha256; c=relaxed/relaxed; d=163.com; s=s110527; h=From:Content-Type:Mime-Version:Subject:Message-Id: Date; bh=IbGPLr1MWdrW1uKxQRNDQClhTUMONRbQEeL29gIPhfQ=; b=`;

        const bh = tohex("IbGPLr1MWdrW1uKxQRNDQClhTUMONRbQEeL29gIPhfQ=");
        const rb = "0x7ffabdb0c2641c19caccc1002fdf1a666d07872151ee0fcf473d6859c4aa5901cbfc33cac727cda539e4e078f9493ee4d9a5bb88776db06686ebfe1271e94c6677d3496176b56b7236cbb025df54b0b40c0b742f1ff44f16034122e3d70a84adedf2f68fb21efacaa7028d631313eda491ccb1578d4d1cd7ae6787f75f49a6f3"
        const base = shaHashHex(msg);
        const e = "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010001";
        const body = tohex(`\r\n--Apple-Mail=_4FC58AE1-1B6B-447A-A148-F8A2941E0CD1\r\nContent-Transfer-Encoding: 7bit\r\nContent-Type: text/plain;\r\n charset=us-ascii\r\n\r\nPK:0x5a26db057de3d243686c0ddd09599aa6a8aac9d4\r\n--Apple-Mail=_4FC58AE1-1B6B-447A-A148-F8A2941E0CD1\r\nContent-Transfer-Encoding: 7bit\r\nContent-Type: text/html;\r\n charset=us-ascii\r\n\r\n<html><head><meta http-equiv="Content-Type" content="text/html; charset=us-ascii"></head><body style="word-wrap: break-word; -webkit-nbsp-mode: space; line-break: after-white-space;" class="">PK:<span class="" style="font-family: &quot;Helvetica Neue&quot;; font-size: 13px;">0x5a26db057de3d243686c0ddd09599aa6a8aac9d4</span></body></html>\r\n--Apple-Mail=_4FC58AE1-1B6B-447A-A148-F8A2941E0CD1--\r\n`);

        const _DKIMVerifier = dkimVerifierFactory.attach(dkimVerifierProxy.address);

        const verifierInput = await _DKIMVerifier.getInput(hmua, bh, base);
        expect(await proofVerifier.verifyProof(a,b,c,verifierInput), "verifyProof").to.equal(true);
        expect(await _DKIMVerifier.equalBase64(bh, body), "equalBase64").to.equal(true);
        expect(await _DKIMVerifier.containsAddress(testPublicKey, body), "containsAddress").to.equal(true);
        expect(await _DKIMVerifier.verifyRsa(base, rb, e, _dkim), "rsaVerifier").to.equal(true);

        await entryPoint.depositTo(paymasterProxy.address, { value: parseEther('10') })

        const paymasterProxyImpl = paymasterFactory.attach(paymasterProxy.address);
        await paymasterProxyImpl.addStake(100, { value: parseEther('2') })

        const calldata = await wallet.populateTransaction.addOwner(
            testPublicKey,
            {
                a,
                b,
                c,
                bh,
                ds,
                rb,
                base,
                e,
                body
            }
        ).then(tx => tx.data!);

        // console.log("calldata", calldata);
        
        const op = await fillAndSign({
                sender: preAddr,
                initCode: initCode,
                callData: calldata,
                callGasLimit: 2e6,//2e6 //10000000 //49116 * 20
            //     "verificationGas": "0x1182ac",
            //     "preVerificationGas": "0x1592b",
            //     maxFeePerGas: "0x477E4ED2",
            //     maxPriorityFeePerGas: "0x3B9ACA00",
            //     "signature": "0x"
            //   }, testWalletOwner, entryPoint);
              }, testWalletOwner, entryPoint)

        const hash = await paymasterProxyImpl.getHash(op)
        const sig = await ethersSigner.signMessage(arrayify(hash))
        const userOp = await fillAndSign({
          ...op,
          paymasterAndData: hexConcat([paymasterProxy.address, sig])
        }, testWalletOwner, entryPoint)
        console.log("userOp", userOp);

        // const error = await entryPoint.callStatic.simulateValidation(userOp).catch(e => e);
        // console.log("error", error);

        // await fund(op.sender);

        const rcpt = await entryPoint.handleOps([userOp], prefundAccountAddress, {
            gasLimit: 1e7
          }).then(async t => await t.wait());
          console.log("rcpt:", JSON.stringify(rcpt));

          const [log] = await entryPoint.queryFilter(entryPoint.filters.UserOperationEvent(), rcpt.blockHash)
          expect(log.args.success).to.eq(true)

          const op2 = await fillAndSign({
            sender: preAddr,
            callData: calldata,
        //     callGas: "0x160dbf",//2e6
        //     "verificationGas": "0x1182ac",
        //     "preVerificationGas": "0x1592b",
        //     maxFeePerGas: "0x477E4ED2",
        //     maxPriorityFeePerGas: "0x3B9ACA00",
        //     "signature": "0x"
        //   }, testWalletOwner, entryPoint);

             callGasLimit: 2e6,
          }, testWalletOwner, entryPoint)

          const hash2 = await paymasterProxyImpl.getHash(op2)
          const sig2 = await ethersSigner.signMessage(arrayify(hash2))
          const userOp2 = await fillAndSign({
            ...op2,
            paymasterAndData: hexConcat([paymasterProxy.address, sig2])
          }, testWalletOwner, entryPoint)
          userOp2.signature = "0x";

          const rcpt2 = await entryPoint.handleOps([userOp2], prefundAccountAddress, {
            gasLimit: 1e7
          }).then(async t => await t.wait());
          console.log("userOp2:", userOp2);
          console.log("rcpt2:", JSON.stringify(rcpt2));

          const [log2] = await entryPoint.queryFilter(entryPoint.filters.UserOperationEvent(), rcpt2.blockHash)
          expect(log2.args.success).to.eq(false)

        expect(await walletFactory.attach(op.sender).containOwner(testPublicKey), "containOwner").to.equal(true);

        expect(await paymasterFactory.attach(paymasterProxy.address).supportWallet(op.sender), "supportWallet").to.equal(true);

        expect((await paymasterFactory.attach(paymasterProxy.address).getWallet(hmua)).toLowerCase(), "getWallet").to.equal(op.sender.toLowerCase());
    })

    it("CerscentWallet setAutoUpdateImplementation", async function name() {
        await entryPoint.depositTo(preAddr, { value: parseEther('10') });

        expect(await walletProxyFactory.attach(preAddr).getAutoUpdateImplementation(), "getAutoUpdateImplementation").to.equal(false);

        let upgradeDelegateCalldata = await walletProxy.populateTransaction.setAutoUpdateImplementation(true).then(tx => tx.data!);

        const op = await fillAndSign({
                sender: preAddr,
                callData: upgradeDelegateCalldata,
                callGasLimit: 2e6,
            }, testWalletOwner, entryPoint);

        const rcpt = await entryPoint.handleOps([op], prefundAccountAddress, {
                gasLimit: 1e7
              }).then(async t => await t.wait());

        expect(await walletProxyFactory.attach(preAddr).getAutoUpdateImplementation(), "getAutoUpdateImplementation").to.equal(true);

    });


    it("CerscentPaymaster paymaster support wallet", async function name() {
        let paymasterView = await paymasterFactory.attach(paymasterProxy.address);

        expect(await paymasterView.supportWallet(preAddr), "supportWallet").to.equal(true);
        expect(await paymasterView.getWallet(hmua), "supportWallet").to.equal(preAddr);
    });


    it("CerscentPaymaster upgradeDelegate", async function name() {
        await paymasterProxy.upgradeDelegate(walletController.address);

        expect((await paymasterProxy.getImplementation()).toLowerCase(), "getImplementation").to.equal(walletController.address.toLowerCase());
    });
    
    it("CerscentPaymaster walletController", async function name() {
        expect(await walletController.getImplementation()).to.equal(wallet.address);

        await walletController.setImplementation(paymaster.address)

        expect(await walletProxyFactory.attach(preAddr).getImplementation(), "getImplementation").to.equal(paymaster.address);
    });

});