// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
const axios = require('axios');

const baseUrl = 'https://api.money.126.net/data/feed/';
let statusBarItems = {};
let stockCodes = [];
let updateInterval: any = 10000;
let timer = null;
let showTimer = null;
let show = false;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  // init();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(handleConfigChange)
  );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand('mk-stock.switch', () => {
    // The code you place here will be executed every time your command is executed
    // Display a message box to the user
    show = !show;
    init();
  });

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

function init() {
  // initShowTimeChecker();
  if (isShowTime()) {
    showAllStatusBar();
    stockCodes = getStockCodes();
    updateInterval = getUpdateInterval();
    fetchAllData();
    timer = setInterval(fetchAllData, updateInterval);
  } else {
    hideAllStatusBar();
  }
}

function initShowTimeChecker() {
  showTimer && clearInterval(showTimer);
  showTimer = setInterval(() => {
    if (isShowTime()) {
      init();
    } else {
      timer && clearInterval(timer);
      hideAllStatusBar();
    }
  }, 1000 * 60 * 10);
}

function hideAllStatusBar() {
  Object.keys(statusBarItems).forEach(item => {
    statusBarItems[item].hide();
    // statusBarItems[item].dispose();
  });
}

function showAllStatusBar() {
  Object.keys(statusBarItems).forEach(item => {
    statusBarItems[item].show();
    // statusBarItems[item].dispose();
  });
}

function handleConfigChange() {
  timer && clearInterval(timer);
  showTimer && clearInterval(showTimer);
  const codes = getStockCodes();
  Object.keys(statusBarItems).forEach(item => {
    if (codes.indexOf(item) === -1) {
      statusBarItems[item].hide();
      statusBarItems[item].dispose();
      delete statusBarItems[item];
    }
  });
  init();
}

function getStockCodes() {
  const config = vscode.workspace.getConfiguration();
  const stocks: any = config.get('stock-watch.stocks');
  return stocks.map(code => {
    if (isNaN(code[0])) {
      if (code.toLowerCase().indexOf('us_') > -1) {
        return code.toUpperCase();
      } else if (code.indexOf('hk') > -1) {
        return code;
      } else {
        return code.toLowerCase().replace('sz', '1').replace('sh', '0');
      }
    } else {
      return (code[0] === '6' ? '0' : '1') + code;
    }
  });
}

function getUpdateInterval() {
  const config = vscode.workspace.getConfiguration();
  return config.get('stock-watch.updateInterval');
}

function isShowTime() {
  return show;
  // const config = vscode.workspace.getConfiguration();
  // const configShowTime = config.get('stock-watch.showTime');
  // let showTime = [0, 23];
  // if (
  //   Array.isArray(configShowTime) &&
  //   configShowTime.length === 2 &&
  //   configShowTime[0] <= configShowTime[1]
  // ) {
  //   showTime = configShowTime;
  // }
  // const now = new Date().getHours();
  // return now >= showTime[0] && now <= showTime[1];
}

function getItemText(item) {
  return `「${item.name}」${keepDecimal(item.price, calcFixedNumber(item))} ${
    item.percent >= 0 ? '📈' : '📉'
  } ${keepDecimal(item.percent * 100, 2)}%`;
}

function getTooltipText(item) {
  return `【今日行情】${item.type}${item.symbol}\n涨跌：${
    item.updown
  }   百分：${keepDecimal(item.percent * 100, 2)}%\n最高：${
    item.high
  }   最低：${item.low}\n今开：${item.open}   昨收：${item.yestclose}`;
}

function getItemColor(item) {
  const config = vscode.workspace.getConfiguration();
  const riseColor = config.get('stock-watch.riseColor');
  const fallColor = config.get('stock-watch.fallColor');

  return item.percent >= 0 ? riseColor : fallColor;
}

function fetchAllData() {
  console.log('fetchAllData');
  if (!isShowTime()) {
    clearInterval(timer);
  }
  axios
    .get(`${baseUrl}${stockCodes.join(',')}?callback=a`)
    .then(
      rep => {
        try {
          const result = JSON.parse(rep.data.slice(2, -2));
          let data = [];
          Object.keys(result).map(item => {
            if (!result[item].code) {
              result[item].code = item; //兼容港股美股
            }
            data.push(result[item]);
          });
          displayData(data);
        } catch (error) {}
      },
      error => {
        console.error(error);
      }
    )
    .catch(error => {
      console.error(error);
    });
}

function displayData(data) {
  data.map(item => {
    const key = item.code;
    if (statusBarItems[key]) {
      statusBarItems[key].text = getItemText(item);
      statusBarItems[key].color = getItemColor(item);
      statusBarItems[key].tooltip = getTooltipText(item);
    } else {
      statusBarItems[key] = createStatusBarItem(item);
    }
  });
}

function createStatusBarItem(item) {
  const barItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    0 - stockCodes.indexOf(item.code)
  );
  barItem.text = getItemText(item);
  barItem.color = getItemColor(item);
  barItem.tooltip = getTooltipText(item);
  barItem.show();
  return barItem;
}

function keepDecimal(num, fixed) {
  var result = parseFloat(num);
  if (isNaN(result)) {
    return '--';
  }
  return result.toFixed(fixed);
}

function calcFixedNumber(item) {
  var high =
    String(item.high).indexOf('.') === -1
      ? 0
      : String(item.high).length - String(item.high).indexOf('.') - 1;
  var low =
    String(item.low).indexOf('.') === -1
      ? 0
      : String(item.low).length - String(item.low).indexOf('.') - 1;
  var open =
    String(item.open).indexOf('.') === -1
      ? 0
      : String(item.open).length - String(item.open).indexOf('.') - 1;
  var yest =
    String(item.yestclose).indexOf('.') === -1
      ? 0
      : String(item.yestclose).length - String(item.yestclose).indexOf('.') - 1;
  var updown =
    String(item.updown).indexOf('.') === -1
      ? 0
      : String(item.updown).length - String(item.updown).indexOf('.') - 1;
  var max = Math.max(high, low, open, yest, updown);

  if (max === 0) {
    max = 2;
  }

  return max;
}
