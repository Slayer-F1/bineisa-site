import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createMarketstack, RESEARCH_SYMBOLS } from '../server/marketstack.js';
import { MemoryStore } from '../server/cache.js';
import { createPersistentStore } from '../server/persistent-cache.js';

const now = new Date().toISOString();
function harness(options = {}) {
  const requests = [];
  const fetcher = async (url, init) => {
    const u = new URL(url); requests.push({ url:u, init });
    const symbol = u.searchParams.get('symbols');
    return { ok:true, json:async () => ({ data:[
      {symbol,name:'API supplied company',exchange:'XNAS',exchange_code:'NASDAQ',price_currency:'USD',date:now,close:55,adj_close:55,adj_high:57,adj_low:54,volume:100},
      {symbol,exchange:'XNAS',date:new Date(Date.now()-86400000).toISOString(),close:100,adj_close:50,adj_high:51,adj_low:49,volume:200},
    ] }) };
  };
  return { requests, market:createMarketstack({ key:'private-test-key', store:new MemoryStore(), fetcher, ...options }) };
}

test('Marketstack shares one request across quote, company, chart and concurrent visitors', async () => {
  const {market,requests}=harness();
  const [q,c,h]=await Promise.all([market.quotes(['AMD.US']),market.detail('AMD.US'),market.history('AMD.US')]);
  assert.equal(requests.length,1);
  assert.equal(q.data[0].price,55);
  assert.ok(Math.abs(q.data[0].changePercent-10)<0.0001, 'split-adjusted daily return');
  assert.equal(c.data.name,'API supplied company');
  assert.equal(c.data.metrics.MarketCapitalization,null);
  assert.equal(c.data.analysts.TargetPrice,null);
  assert.deepEqual(c.data.financials.Income_Statement.yearly,[]);
  assert.equal(h.data.length,2);
  assert.equal(q.data[0].asOf,now);
  assert.equal(q.meta.freshness,'end-of-day');
  assert.equal(JSON.stringify(q).includes('private-test-key'),false);
  assert.equal(requests[0].url.origin,'https://api.marketstack.com');
  assert.equal(requests[0].init.redirect,'error');
  await market.quotes(['AMD.US']);
  assert.equal(requests.length,1);
});

test('directory matches all seven observed reference symbols without static prices or names', async () => {
  const {market,requests}=harness();
  const r=await market.screener({exchange:'US'});
  assert.deepEqual(r.data.map(x=>x.symbol), RESEARCH_SYMBOLS.map(x=>`${x}.US`));
  assert.ok(r.data.every(x=>x.name==='API supplied company' && x.price===55));
  assert.equal(requests.length,7);
  assert.equal((await market.search('AMD','US')).data.length,1);
  assert.equal(requests.length,7);
});

test('unsupported symbols, ranges, filters and news never spend provider quota', async () => {
  const {market,requests}=harness();
  await assert.rejects(market.quotes(['AAPL.US']),{code:'SYMBOL_NOT_COVERED'});
  await assert.rejects(market.history('AMD.US','5Y'),{code:'DATA_ENTITLEMENT'});
  await assert.rejects(market.screener({exchange:'US',sector:'Technology'}),{code:'UNSUPPORTED_FILTER'});
  await assert.rejects(market.news(),{code:'DATA_ENTITLEMENT'});
  assert.equal(requests.length,0);
});

test('monthly budget stops fresh requests while cached symbols remain readable', async () => {
  const {market,requests}=harness({monthlyBudget:1});
  await market.detail('AMD.US');
  await assert.rejects(market.detail('APPF.US'),{code:'MONTHLY_QUOTA'});
  assert.equal((await market.detail('AMD.US')).meta.cached,true);
  assert.equal(requests.length,1);
});

test('provider errors are sanitized and a cooldown avoids repeated quota consumption', async () => {
  let calls=0;
  const {market}=harness({fetcher:async()=>{calls++;return {ok:false,status:401,json:async()=>({error:{code:'invalid_access_key',message:'private-test-key'}})};}});
  await assert.rejects(market.detail('AMD.US'),err=>err.code==='DATA_ENTITLEMENT' && !err.message.includes('private-test-key'));
  await assert.rejects(market.detail('AMD.US'),{code:'PROVIDER_BUSY'});
  assert.equal(calls,1);
});

test('invalid or mismatched provider rows cannot become a stock quote', async () => {
  const {market}=harness({fetcher:async()=>({ok:true,json:async()=>({data:[{symbol:'OTHER',exchange:'XNAS',date:now,close:1,adj_close:1}]})})});
  await assert.rejects(market.detail('AMD.US'),{code:'NOT_FOUND'});
});

test('disk cache retains data and monthly quota across process restarts', async () => {
  const dir=await mkdtemp(path.join(tmpdir(),'bineisa-cache-test-'));
  try {
    let store=await createPersistentStore(dir);
    await store.set('marketstack:test:AMD.US',{price:55},60);
    await Promise.all(Array.from({length:5},()=>store.increment('budget:marketstack:test:month',60)));
    await store.set('client:do-not-persist','private',60);
    await store.close();
    store=await createPersistentStore(dir);
    assert.deepEqual(await store.get('marketstack:test:AMD.US'),{price:55});
    assert.equal(await store.get('budget:marketstack:test:month'),5);
    assert.equal(await store.get('client:do-not-persist'),null);
  } finally {
    assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'bineisa-cache-test-'));
    await rm(dir,{recursive:true,force:true});
  }
});

test('Marketstack still rejects demo credentials in production', () => {
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('../server/index.js',import.meta.url))], {
    env:{...process.env, NODE_ENV:'production', MARKET_PROVIDER:'marketstack', MARKETSTACK_API_KEY:'demo'}, encoding:'utf8',timeout:5000,
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Demo credentials are forbidden/);
});
