
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers, run } from 'hardhat'
import { address } from '../test/solidityTypes'
import { tohex } from '../test/testutils'


const verify = async (contractAddress: string, args: any[], contract: string | undefined = undefined) => {
  console.log("Verifying contract address:", contractAddress)
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
      contract
    })
    console.log("Verifying contract successful, address:", contractAddress)
  } catch (e: any) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("Already Verified!")
    } else {
      console.log(e)
    }
  }
}

const WAIT_BLOCK_CONFIRMATIONS = 2;

//SingletonFactory
let create2Address = "0xce0042B868300000d44A59004Da54A005ffdcf9f";

const deployCrescentWallet: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const provider = ethers.provider;
    const from = await provider.getSigner().getAddress();
    console.log("deployCrescentWallet, from:", from);

    //========================= EntryPoint ===============================
    console.log(`Deployed EntryPoint contract start`)
    const entryPointFactory = await ethers.getContractFactory("EntryPoint")
    const entryPoint = await entryPointFactory.deploy()
    const entryPointRep = await entryPoint.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS)

    const entryPointAddress = entryPoint.address;
    console.log(`Deployed EntryPoint contract to: ${entryPointAddress}, gas used ${entryPointRep.gasUsed}`)

    //========================= EntryPointController ===============================
    console.log(`Deployed EntryPointController contract start`)
    const entryPointControllerFactory = await ethers.getContractFactory("EntryPointController")
    const entryPointController = await entryPointControllerFactory.deploy()
    const entryPointControllerRep = await entryPointController.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS)

    const entryPointControllerAddress = entryPointController.address;
    console.log(`Deployed EntryPointController contract to: ${entryPointControllerAddress}, gas used ${entryPointControllerRep.gasUsed}`)


    //========================= DKIMManager ===============================
    console.log(`Deployed DKIMManager contract start`)
    const dkimManagerFactory = await ethers.getContractFactory("DKIMManager")
    const dkimManager = await dkimManagerFactory.deploy()
    const dkimManagerRep = await dkimManager.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS)

    const dkimManagerAddress = dkimManager.address;
    console.log(`Deployed DKIMManager contract to: ${dkimManagerAddress}, gas used ${dkimManagerRep.gasUsed}`)

    //========================= ProofVerifier ===============================
    console.log(`Deployed ProofVerifier contract start`)
    const proofVerifierFactory = await ethers.getContractFactory("Verifier");
    const proofVerifier = await proofVerifierFactory.deploy();
    const proofVerifierRep = await proofVerifier.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS)

    const proofVerifierAddress = proofVerifier.address;
    console.log(`Deployed ProofVerifier contract to: ${proofVerifierAddress}, gas used ${proofVerifierRep.gasUsed}`)

    //========================= SolRsaVerify ===============================
    console.log(`Deployed SolRsaVerify contract start`)
    const rsaVerifierFactory = await ethers.getContractFactory("SolRsaVerify");
    const rsaVerify = await rsaVerifierFactory.deploy();
    const rsaVerifyRep = await rsaVerify.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS)

    const rsaVerifyAddress = rsaVerify.address;
    console.log(`Deployed SolRsaVerify contract to: ${rsaVerifyAddress}, gas used ${rsaVerifyRep.gasUsed}`)


    //========================= DKIMVerifier ===============================
    console.log(`Deployed DKIMVerifier contract start`)
    const dkimVerifierFactory = await ethers.getContractFactory("DKIMVerifier")
    const dkimVerifier = await dkimVerifierFactory.deploy()
    const dkimVerifierRep = await dkimVerifier.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS)

    const dkimVerifierAddress = dkimVerifier.address;
    console.log(`Deployed DKIMVerifier contract to: ${dkimVerifierAddress}, gas used ${dkimVerifierRep.gasUsed}`)


    //========================= DKIMVerifierProxy ===============================
    console.log(`Deployed DKIMVerifierProxy contract start`)
    const dkimVerifierProxyFactory = await ethers.getContractFactory("DKIMVerifierProxy");
    const dkimVerifierProxy = await dkimVerifierProxyFactory.deploy(dkimVerifierAddress, dkimManagerAddress, proofVerifierAddress, rsaVerifyAddress);
    const dkimVerifierProxyRep = await dkimVerifierProxy.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS)

    const dkimVerifierProxyAddress = dkimVerifierProxy.address;
    console.log(`Deployed DKIMVerifierProxy contract to: ${dkimVerifierProxyAddress}, gas used ${dkimVerifierProxyRep.gasUsed}`)


    //========================= CrescentWallet ===============================
    console.log(`Deployed CrescentWallet contract start`)
    const walletFactory = await ethers.getContractFactory("CrescentWallet")
    const wallet = await walletFactory.deploy()
    const walletRep = await wallet.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS)

    const walletAddress = wallet.address;
    console.log(`Deployed CrescentWallet contract to: ${walletAddress}, gas used ${walletRep.gasUsed}`)

    //==================== CrescentWalletController ===========================
    console.log(`Deployed CrescentWalletController contract start`)
    const walletControllerFactory = await ethers.getContractFactory("CrescentWalletController")
    const walletController = await walletControllerFactory.deploy(walletAddress)
    const walletControllerRep = await walletController.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS)

    const walletControllerAddress = walletController.address;
    console.log(`Deployed CrescentWalletController contract to: ${walletControllerAddress}, gas used ${walletControllerRep.gasUsed}`)


    //==================== CrescentWalletProxy ===========================
    console.log(`Deployed CrescentWalletProxy contract start`)
    const walletProxyFactory = await ethers.getContractFactory("CrescentWalletProxy")
    const walletProxy = await walletProxyFactory.deploy(entryPointControllerAddress, walletControllerAddress, dkimVerifierProxyAddress, "0x0000000000000000000000000000000000000000000000000000000000000000")
    const walletProxyRep = await walletProxy.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS)

    const walletProxyAddress = walletProxy.address;
    console.log(`Deployed CrescentWalletProxy contract to: ${walletProxyAddress}, gas used ${walletProxyRep.gasUsed}`)


    //==================== CrescentPaymaster ===========================
    console.log(`Deployed CrescentPaymaster contract start`)
    const paymasterFactory = await ethers.getContractFactory("CrescentPaymaster")
    const paymaster = await paymasterFactory.deploy()
    const paymasterRep = await paymaster.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS)

    const paymasterAddress = paymaster.address;
    console.log(`Deployed CrescentPaymaster contract to: ${paymasterAddress}, gas used ${paymasterRep.gasUsed}`)


    //==================== CrescentPaymasterProxy ===========================
    console.log(`Deployed CrescentPaymasterProxy contract start`)
    const paymasterProxyFactory = await ethers.getContractFactory("CrescentPaymasterProxy")
    const paymasterProxy = await paymasterProxyFactory.deploy(paymasterAddress, create2Address, entryPointControllerAddress, walletControllerAddress, dkimVerifierProxyAddress)
    const paymasterProxyRep = await paymasterProxy.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS)

    const paymasterProxyAddress = paymasterProxy.address;
    console.log(`Deployed CrescentPaymasterProxy contract to: ${paymasterProxyAddress}, gas used ${paymasterProxyRep.gasUsed}`)


    try {
      console.log(`setEntryPoint start`);
      const setEntryPointRep = await (await entryPointController.setEntryPoint(entryPoint.address)).wait(WAIT_BLOCK_CONFIRMATIONS);
      console.log(`setEntryPoint end, gas used`, setEntryPointRep.gasUsed);
    } catch (e) {
      console.log("setEntryPoint", e);
    }


    try {
      console.log(`addStake start`);
      const addStakeRep = await (await paymasterFactory.attach(paymasterProxyAddress).addStake(100, { value: ethers.utils.parseEther('0.01') })).wait(WAIT_BLOCK_CONFIRMATIONS);
      console.log(`addStake end, gas used`, addStakeRep.gasUsed);
    } catch (e) {
      console.log("addStake", e);
    }

    try {
      console.log(`depositTo start`);
      const depositToRep = await (await entryPointFactory.attach(entryPointAddress).depositTo(paymasterProxy.address, { value: ethers.utils.parseEther('0.1') })).wait(WAIT_BLOCK_CONFIRMATIONS);
      console.log(`depositTo end, gas used`, depositToRep.gasUsed);
    } catch (e) {
        console.log("depositTo", e);
    }

    await verifyContract(
        entryPointAddress,
        entryPointControllerAddress,
        dkimManagerAddress,
        proofVerifierAddress,
        rsaVerifyAddress,
        dkimVerifierAddress, 
        dkimVerifierProxyAddress,
        walletAddress, 
        walletControllerAddress, 
        walletProxyAddress, 
        paymasterAddress,
        paymasterProxyAddress
    );
};

const verifyContract = async (
        entryPointAddress: address,
        entryPointControllerAddress: address,
        dkimManagerAddress: address,
        proofVerifierAddress: address,
        rsaVerifyAddress: address,
        dkimVerifierAddress: address,
        dkimVerifierProxyAddress: address,
        walletAddress: address,
        walletControllerAddress: address,
        walletProxyAddress: address,
        paymasterAddress: address,
        paymasterProxyAddress: address
        ) => {
    await verify(entryPointAddress, []);

    await verify(entryPointControllerAddress, []);

    await verify(proofVerifierAddress, []);

    await verify(rsaVerifyAddress, []);

    await verify(dkimManagerAddress, []);

    await verify(dkimVerifierAddress, []);

    await verify(dkimVerifierProxyAddress, [dkimVerifierAddress, dkimManagerAddress, proofVerifierAddress, rsaVerifyAddress]);

    await verify(walletAddress, []);

    await verify(walletControllerAddress, [walletAddress]);

    await verify(walletProxyAddress, [entryPointControllerAddress, walletControllerAddress, dkimVerifierProxyAddress, "0x0000000000000000000000000000000000000000000000000000000000000000"]);

    await verify(paymasterAddress, []);

    await verify(paymasterProxyAddress, [paymasterAddress, create2Address, entryPointControllerAddress, walletControllerAddress, dkimVerifierProxyAddress], 'contracts/wallet/CrescentPaymasterProxy.sol:CrescentPaymasterProxy');
}

const verifyCrescentWallet: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider;
  const from = await provider.getSigner().getAddress();
  console.log("verifyCrescentWallet, from:", from);


  const entryPointAddress = '0x7CEf2B7e2499EC9bcD3b25788133634C5ea49295';

  const entryPointControllerAddress = '0x53b4a3C94487c911d76692cf45809E19ad9f4912';

  const dkimManagerAddress = '0x5b3b9022754514ED22416d77384C8f3f09439Eb0';

  const proofVerifierAddress = '0x7a163e58C209d8cB098D0449089D0101b055e4E2';

  const rsaVerifyAddress = '0x460fE627C1Be0b7353E4C282bF12A513F31B92eB';

  const dkimVerifierAddress = '0xaD6954B6203CF067A73EB3EFcf4946a30aa23015';

  const dkimVerifierProxyAddress = '0x3b523F035fDDbC0ea5cf0eED0c5Ac749502091ce';


  const walletAddress = "0x516A7BB75cB00E6B51bD7Df0Dd3ffc7C9B6aC7B5";

  const walletControllerAddress = "0x88976a08C66B6B12449444213ab02eD61df4FF20";

  const walletProxyAddress = "0xb35996E1d4C6be6b6F544458939936caA48172b7";

  const paymasterAddress = "0xBC2fC30D3F12F7c082dD84937733B03445A30Dc9";

  const paymasterProxyAddress = "0x2F2DBb9002C22b313b4FcD840Dbf740F4034E037";

  await verifyContract(
    entryPointAddress,
    entryPointControllerAddress,
    dkimManagerAddress,
    proofVerifierAddress,
    rsaVerifyAddress,
    dkimVerifierAddress, 
    dkimVerifierProxyAddress,
    walletAddress, 
    walletControllerAddress, 
    walletProxyAddress, 
    paymasterAddress,
    paymasterProxyAddress
  );
};


const addDkim: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider;
  const from = await provider.getSigner().getAddress();
  console.log("addDkim from:", from);

  const dkimManagerAddress = '0x50c18f1e36174E8bC852bc7A240C968AC11fba07';

  const dkimManagerFactory = await ethers.getContractFactory("DKIMManager");
  const dkimManager = dkimManagerFactory.attach(dkimManagerAddress);
  const allDs = [
    {
      name: '0x32303231303131322e5f646f6d61696e6b65792e676d61696c2e636f6d',
      key: '0xABC27154130B1D9463D56BC83121C0A516370EB684FC4885891E88300943ABD1809EB572D2D0D0C81343D46F3ED5FCB9470B2C43D0E07CD7BBAC89B0C5A6D67D6C49D4B4A6A3F0F311D38738935088FFE7C3B31D986BBE47D844BC17864500269F58E43B8E8A230FE9DA51AF98F49EDFE0150FE5F2697678BC919364A1540A7A1CB40554C878D20D3ECA9C4B1A88D0F6AD5B03BF28AC254007F84C917E61D20707C954701D27DA03F1C9FD36322E9FF1072D2230842C5798B26568978D005B5C19E0F669119B1DA4BB33A69314FFAA9387F6B9C471DF57320B16EEE7408355F53E778264203341143895F8C22968315721FD756C6A12D3CA010508B23D7817D3'
    },
    {
      name: '0x733131303532372e5f646f6d61696e6b65792e3136332e636f6d',
      key: '0xA9F49A52EC4391363C089ED5C8235EE626EC286FE849A15987AF68761CFA5213B418821F35E641DD602E096F15E070FD26359398DD1D5593A7540D1F0D4222FEC41F5F44D5854B7E93ABB0B33C4FD423FF8FC5684FCCF9EF001AF881B41CADEB3C79EF5C80430F143A5C9383BB50B3493711F4D3739F7268752BEC431B2A8F59'
    },
    {
      name: '0x73323034382e5f646f6d61696e6b65792e7961686f6f2e636f6d',
      key: '0xBA85AE7E06D6C39F0C7335066CCBF5EFA45AC5D64638C9109A7F0E389FC71A843A75A95231688B6A3F0831C1C2D5CB9B271DA0CE200F40754FB4561ACB22C0E1AC89512364D74FEEA9F072894F2A88F084E09485AE9C5F961308295E1BB7E835B87C3BC0BCE0B827F8600A11E97C54291B00A07BA817B33EBFA6CC67F5F51BEBE258790197851F80943A3BC17572428AA19E4AA949091F9A436AA6E0B3E1773E9CA201441F07A104CCE03528C3D15891A9CE03ED2A8BA40DC42E294C3D180BA5EE4488C84722CEAADB69428D2C6026CF47A592A467CC8B15A73EA3753D7F615E518BA614390E6C3796EA37367C4F1A109646D5472E9E28E8D49E84924E648087'
    },
    {
      name: '0x6d61696c2e5f646f6d61696e6b65792e736f68752e636f6d',
      key: '0xD84FFA649D394AEF4BAA9E49FE3239A4BE67576819D79D15D5E7A65B056A05AAFEEEFE40541FF6173069E6898E5FE33C308E7CC773C3B808078790C21444DE8E5DBF488CE95D85490F88E2F8F00C6D92619D5AB2FF88E2DE3EC8EE0EA27F6401189DAF00285904F04375BAF54FE5375308A302478E9908959746F7FF6555189B'
    },
    {
      name: '0x733230313531322e5f646f6d61696e6b65792e71712e636f6d',
      key: '0xCFB0520E4AD78C4ADB0DEB5E605162B6469349FC1FDE9269B88D596ED9F3735C00C592317C982320874B987BCC38E8556AC544BDEE169B66AE8FE639828FF5AFB4F199017E3D8E675A077F21CD9E5C526C1866476E7BA74CD7BB16A1C3D93BC7BB1D576AEDB4307C6B948D5B8C29F79307788D7A8EBF84585BF53994827C23A5'
    }
  ]

  for (const ds of allDs) {
    try {
      const result = await dkimManager.dkim(ds.name);
      console.log("dkim result:", result);
      if (result && result != '0x' && result.length > 2) {
        console.log("exsit name:", ds.name);
        continue;
      }
      const ret = await (await dkimManager.upgradeDKIM(ds.name, ds.key)).wait(WAIT_BLOCK_CONFIRMATIONS);
      console.log("ret gasUsed", ret.gasUsed);
    } catch(e) {
      console.log("upgradeDKIM", e);
    }
  }
};

const depositTo: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider;
  const from = await provider.getSigner().getAddress();
  console.log("depositTo, from:", from);
  
  const entryPointAddress = '0x7CEf2B7e2499EC9bcD3b25788133634C5ea49295';

  const paymasterProxyAddress = "0x2F2DBb9002C22b313b4FcD840Dbf740F4034E037";

  try {
    const entryPointFactory = await ethers.getContractFactory("EntryPoint")
    console.log(`depositTo start`);
    const depositToRep = await (await entryPointFactory.attach(entryPointAddress).depositTo(paymasterProxyAddress, { value: ethers.utils.parseEther('3') })).wait(WAIT_BLOCK_CONFIRMATIONS);
    console.log(`depositTo end, gas used`, depositToRep.gasUsed);
  } catch (e) {
      console.log("depositTo", e);
  }

};

// export default verifyCrescentWallet
// export default addDkim
export default depositTo
// export default deployCrescentWallet