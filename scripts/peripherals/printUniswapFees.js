const fs = require('fs')

const { contractAt } = require("../shared/helpers")
const { expandDecimals, bigNumberify } = require("../../test/shared/utilities")
const { Token } = require('@uniswap/sdk-core')
const { tickToPrice, Pool, Position } = require('@uniswap/v3-sdk')

const uniswapFeeReference = require("../../uniswap-fee-reference.json")

const UniNftManager = require("../../artifacts/contracts/amm/UniNftManager.sol/UniNftManager.json")

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const MILLISECONDS_PER_WEEK = 7 * MILLISECONDS_PER_DAY

function roundToNearestWeek(timestamp, dayOffset) {
  return parseInt(timestamp / MILLISECONDS_PER_WEEK) * MILLISECONDS_PER_WEEK + dayOffset * MILLISECONDS_PER_DAY
}

async function main() {
  const MAX_UINT128 = bigNumberify(2).pow(128).sub(1)
  const nftManager = await contractAt("UniNftManager", "0xC36442b4a4522E871399CD717aBDD847Ab11FE88")

  const uniPool = await contractAt("UniPool", "0x80A9ae39310abf666A87C743d6ebBD0E8C42158E")
  const weth = new Token(42161, "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", 18, "SYMBOL", "NAME")
  const gmx = new Token(42161, "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a", 18, "SYMBOL", "NAME")

  const poolInfo = await uniPool.slot0()

  const pool = new Pool(
    weth, // weth
    gmx, // gmx
    10000, // fee
    poolInfo.sqrtPriceX96, // sqrtRatioX96
    1, // liquidity
    poolInfo.tick, // tickCurrent
    []
  )

  const nftIds = [33985, 566, 16, 17, 18, 19, 20, 21, 22, 2726, 16797, 16809, 16810, 17079, 17080, 24729, 25035, 25921, 31374, 69112, 69115, 69119, 69120, 34143, 1382528]

  console.log("NFT ID,Fees")
  let totalETH = bigNumberify(0)
  let totalGMX = bigNumberify(0)
  for (let i = 0; i < nftIds.length; i++) {
    const nftId = nftIds[i]
    const owner = await nftManager.ownerOf(nftId)
    const positionInfo = await nftManager.positions(nftId)

    const voidSigner = new ethers.VoidSigner(owner, nftManager.provider)
    const uniPositionManager = new ethers.Contract(nftManager.address, UniNftManager.abi, voidSigner)

    const params = {
      tokenId: bigNumberify(nftId).toHexString(),
      recipient: owner,
      amount0Max: MAX_UINT128,
      amount1Max: MAX_UINT128
    }

    const collectResult = await uniPositionManager.callStatic.collect(params, { from: owner })
    console.log(`NFT_${nftId},${ethers.utils.formatUnits(collectResult.amount0, 18)},${ethers.utils.formatUnits(collectResult.amount1, 18)}`)
    totalETH = totalETH.add(collectResult.amount0)
    totalGMX = totalGMX.add(collectResult.amount1)
  }

  const refTimestamp = roundToNearestWeek(Date.now(), 6)
  const delta = totalETH.sub(bigNumberify(uniswapFeeReference.totalETH))

  if (uniswapFeeReference.refTimestamp > refTimestamp) {
    totalETH = bigNumberify(uniswapFeeReference.totalETH)
  }

  const filename = `./uniswap-fee-reference.json`

  console.log(`total: ${ethers.utils.formatUnits(totalETH, 18)} ETH, ${ethers.utils.formatUnits(totalGMX, 18)} GMX`)
  const data = {
    refTimestamp,
    totalETH: totalETH.toString(),
    totalGMX: totalGMX.toString(),
    delta: delta.toString()
  }

  fs.writeFileSync(filename, JSON.stringify(data, null, 4))
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
