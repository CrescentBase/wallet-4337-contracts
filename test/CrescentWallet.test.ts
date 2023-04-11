import { expect } from 'chai'
import { ethers } from 'hardhat'

import web3 from 'web3'

import { fillAndSign, fillUserOp } from './UserOp'

import { BigNumber, Wallet } from 'ethers'

import crypto from "crypto";

import {
    AddressZero,
    fund,
    getBalance,
    getTokenBalance, rethrow,
    checkForGeth, calcGasUsage, deployEntryPoint, checkForBannedOps, createAddress, ONE_ETH,
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

export function tohex(str: string): string  {
    return '0x' + Buffer.from(str).toString("hex");
}


export function shaHashHex(str: string): string {
  return '0x' + crypto.createHash("sha256").update(str).digest().toString('hex')
}


describe('test CrescentWallet', function () {
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
    const salt = "0xcABA3ECcF3Aaa03Ad162daE9ceCEaFCaCa9aE5F199B702a3fA4DCAbCc0451D98";

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
        console.log("hmua:", hmua);

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
        console.log("wallet dkimVerifierProxy:",  dkimVerifierProxy.address);
        initCode = await create2Factory.getDeployTransactionCallData(initCode);
        initCode = hexConcat([Create2Factory_EIP2470.contractAddress, initCode]);

        // console.log("initCode", initCode);
        preAddr = await entryPoint.callStatic.getSenderAddress(initCode).catch(e => e.errorArgs.sender);

    })


    it("CrescentWallet DKIMManager", async () => {
        await dkimManager.upgradeDKIM(ds, _dkim);
        expect(await dkimManager.dkim(ds)).to.equal(_dkim);
    })

    it("CrescentWallet check entryPoint", async function name() {
      await (await entryPointController.setEntryPoint(entryPoint.address)).wait();

      expect((await walletFactory.attach(walletProxy.address).entryPoint()).toLowerCase(), 'wallet entryPoint').to.equal(entryPoint.address.toLowerCase());

      expect((await paymasterFactory.attach(paymasterProxy.address).entryPoint()).toLowerCase(), 'paymaster entryPoint').to.equal(entryPoint.address.toLowerCase());
    })

    it("CrescentWallet walletProxy", async function name() {
      expect(await walletProxy.getAutoUpdateImplementation()).to.equal(false);
      // await walletProxy.setAutoUpdateImplementation(true);
      expect(await walletProxy.getImplementation(), "getImplementation").to.equal(wallet.address);
    })

    it("CrescentWallet Paymaster", async function name() {
      const paymaster = paymasterFactory.attach(paymasterProxy.address);
      expect(await paymaster.verifyingSigner(), "verifyingSigner").to.equal(prefundAccountAddress);

      expect(await paymaster.entryPointController(), "entryPointController").to.equal(entryPointController.address);

      expect(await paymaster.walletController(), "walletController").to.equal(walletController.address);

      expect(await paymaster.dkimVerifier(), "dkimVerifier").to.equal(dkimVerifierProxy.address);

      // console.log('getCrescentWalletProxy:', await paymaster.getCrescentWalletProxy());
    })


    it("CrescentWallet dkimVerifier", async function name() {
      const dkimVerifier = dkimVerifierFactory.attach(dkimVerifierProxy.address);
      expect(await dkimVerifier.dkimManager(), "dkimManager").to.equal(dkimManager.address);

      expect(await dkimVerifier.proofVerifier(), "dkimVerifier").to.equal(proofVerifier.address);

      expect(await dkimVerifier.rsaVerify(), "rsaVerifier").to.equal(rsaVerify.address);

    })

    
    it("CrescentWallet create sender", async function name() {
        const a: [string, string] = [
          '0x1415ff5ce3d96946c2f0c6fe29b8b1a0ea70395522d23c141e38195b84cc5b86',
          '0x0ec78471ce88b5787814ea48bc6da06740b67823231955042e66f71b4bf8577c'
        ];
        const b: [[string, string], [string, string]] = [
            [
              '0x0aae3d2a042752da8a051adf30f59b8cc4d28d8c694753520991766767de493f',
              '0x2ce9c170232125ee892ad55cbb5ae04789b70e3dbfec564390d0061b5e180333'
            ],
            [
              '0x1e6b49ab0504e23384803055082b5d68b107bb4a27abd576f123cacc67702841',
              '0x1763aa77801180dbb712189497afc4f829f08cff80ff5307af8d32fd0c75fd80'
            ]
          ];
        const c: [string, string] = [
            '0x2a41a02469a1de920a544c482e71c68c9ddc3c768c505dbb375ed3d619a3eb46',
            '0x1bd8814bc97593de947fa49a0b60b9a10dfd363edb29e06dbd759c40f3320459'
          ];
        const msg = `from:PPYang <hlbt_bt@163.com>\r\ncontent-type:text/plain; charset=us-ascii\r\nmime-version:1.0 (Mac OS X Mail 16.0 \\(3696.120.41.1.1\\))\r\nsubject:TTT\r\nmessage-id:<0EBD7CF8-C373-41ED-BE0F-99A96F722836@163.com>\r\ndate:Tue, 14 Mar 2023 20:08:32 +0800\r\ndkim-signature:v=1; a=rsa-sha256; c=relaxed/relaxed; d=163.com; s=s110527; h=From:Content-Type:Mime-Version:Subject:Message-Id: Date; bh=x3ige2ClGwPzvvJqQQ7WiXOdG5sMedxqsTLUwA3oKDQ=; b=`;

        const bh = tohex("x3ige2ClGwPzvvJqQQ7WiXOdG5sMedxqsTLUwA3oKDQ=");
        const rb = "0x0936990b060e932a35502442272f360df2e594def54a8bb8148a5ed4481819f52f1632455165afb2dfaf2c6d8e18f2255b00c925b6c76375182658c9740a07a149f36b27cec697049c7cc8bfe8e8939e58c5b7b219143c384cf287d54227d30caa359d1327056214b3327c7fc4cd1b3baf5f4835ad26afbd6372ce7ed88b2f51"
        const base = shaHashHex(msg);
        const e = "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010001";
        const body = tohex(`PK:0x5a26db057de3d243686c0ddd09599aa6a8aac9d4\r\n`);

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

        console.log("calldata", calldata);
        
        const op = await fillAndSign({
                sender: preAddr,
                initCode: initCode,
                callData: calldata,
                callGasLimit: 2e6,//2e6 //10000000 //49116 * 20
                // verificationGasLimit : "0x583fbd",
                // preVerificationGas: "0x21648",
                // maxFeePerGas: "0x1ff148c239",
                // maxPriorityFeePerGas: "0x805801315",
                // signature : "0x"
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
          expect(log.args.success, 'call handleOps').to.eq(true)

          expect(await walletFactory.attach(preAddr).hmua(), 'checke hmua').to.eq(hmua)
          

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

    it("CrescentPaymaster test tranfer", async function name() {
      await (await ethersSigner.sendTransaction({
        to: preAddr,
        value: parseEther('10')
      })).wait();

      expect(await ethers.provider.getBalance(preAddr)).to.eq(parseEther('10'))

      const tx = await wallet.populateTransaction.transfer(testPublicKey, parseEther('1'));
      const op = await fillAndSign({
        sender: preAddr,
        callData: tx.data,
        callGasLimit: 2e6,
      }, testWalletOwner, entryPoint);

      const rcpt = await entryPoint.handleOps([op], prefundAccountAddress, {
        gasLimit: 1e7
      }).then(async t => await t.wait());

      const [log] = await entryPoint.queryFilter(entryPoint.filters.UserOperationEvent(), rcpt.blockHash)
      expect(log.args.success, 'call handleOps').to.eq(true)

      expect(await ethers.provider.getBalance(preAddr)).to.lt(parseEther('9'))

      expect(await ethers.provider.getBalance(testPublicKey)).to.eq(parseEther('1'))
    });
  

    it("CrescentWallet setAutoUpdateImplementation", async function name() {
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


    it("CrescentPaymaster paymaster support wallet", async function name() {
        let paymasterView = await paymasterFactory.attach(paymasterProxy.address);

        expect(await paymasterView.supportWallet(preAddr), "supportWallet").to.equal(true);
        expect(await paymasterView.getWallet(hmua), "supportWallet").to.equal(preAddr);
    });


    it("CrescentPaymaster upgradeDelegate", async function name() {
        await paymasterProxy.upgradeDelegate(walletController.address);

        expect((await paymasterProxy.getImplementation()).toLowerCase(), "getImplementation").to.equal(walletController.address.toLowerCase());
    });
    
    it("CrescentPaymaster walletController", async function name() {
        expect(await walletController.getImplementation()).to.equal(wallet.address);

        await walletController.setImplementation(paymaster.address)

        expect(await walletProxyFactory.attach(preAddr).getImplementation(), "getImplementation").to.equal(paymaster.address);
    });

});