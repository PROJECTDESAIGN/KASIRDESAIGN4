/**
 * KODE.GS - BACKEND GOOGLE APPS SCRIPT
 * Dwisyafitriproject POS / katalog produk
 *
 * Pasang seluruh file ini di Google Apps Script sebagai Code.gs.
 * Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 */

var APP_NAME = 'dwisyafitriproject store';
var APP_SHORT_NAME = 'dwisyafitriproject store';
var APP_VERSION = 'catalog-json-v4';
var RECEIPT_FOLDER_PROPERTY = 'RECEIPT_FOLDER_ID';

var APP_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
  '<rect width="512" height="512" rx="96" fill="#F3F4F6"/>' +
  '<g fill="none" stroke="#fff" stroke-width="24" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="140" y="210" width="232" height="196" rx="16"/>' +
  '<path d="M196 210c0-36 27-76 60-76s60 40 60 76"/>' +
  '<line x1="196" y1="290" x2="316" y2="290"/>' +
  '</g>' +
  '<text x="256" y="462" font-family="Arial" font-size="52" font-weight="700" fill="#d9f99d" text-anchor="middle">STORE</text>' +
  '</svg>';

function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = String(params.action || '').trim();
  var callback = getSafeJsonpCallback_(params.callback);
  var payload = parseQueryPayload_(params.payload);
  var readOnly = {
    getPublicProduk: true,
    getProduk: true,
    getReview: true
  };

  // JSONP adalah jalur utama katalog untuk GitHub Pages, Cloudflare Pages,
  // Hostinger, dan hosting statis lain yang tidak dapat membaca CORS GAS.
  if (action && readOnly[action]) {
    var result;
    try {
      result = handleAction(action, payload);
    } catch (err) {
      result = createErrorResult_('GET_ACTION_ERROR', err);
    }
    if (callback) return createJsonpResponse_(callback, result);
    return jsonResponse(result);
  }

  if (params.manifest === '1') {
    return jsonResponse(getWebAppManifest_());
  }

  // Endpoint ringan untuk memastikan deployment yang aktif sudah memakai
  // Code.gs terbaru sebelum website static diuji dari laptop atau mobile.
  if (params.health === '1') {
    var health = {
      ok: true,
      app: APP_NAME,
      version: APP_VERSION,
      jsonp: !!callback
    };
    return callback
      ? createJsonpResponse_(callback, health)
      : jsonResponse(health);
  }

  if (params.icon === '1') {
    return ContentService.createTextOutput(APP_ICON_SVG)
      .setMimeType(ContentService.MimeType.XML);
  }

  if (params.receipt) {
    return renderReceiptPage_(params.receipt);
  }

  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    var body = e && e.postData && e.postData.contents
      ? e.postData.contents
      : '{}';
    var params;
    try {
      params = JSON.parse(body);
    } catch (parseError) {
      return jsonResponse(createErrorResult_('INVALID_JSON', parseError));
    }
    if (!params || typeof params !== 'object' || !params.action) {
      return jsonResponse({
        ok: false,
        errorCode: 'INVALID_ACTION',
        message: 'Body harus berisi action dan payload JSON.'
      });
    }
    return jsonResponse(handleAction(params.action, params.payload));
  } catch (err) {
    return jsonResponse(createErrorResult_('POST_ACTION_ERROR', err));
  }
}

// Dipakai ketika index.html dibuka langsung sebagai Google Apps Script Web App.
// google.script.run menerima nilai string dengan aman dari wrapper ini.
function handleActionForClient(action, payload) {
  try {
    return JSON.stringify(handleAction(action, payload));
  } catch (err) {
    return JSON.stringify(createErrorResult_('CLIENT_ACTION_ERROR', err));
  }
}

function jsonResponse(value) {
  var json;
  try {
    json = JSON.stringify(value);
  } catch (err) {
    json = JSON.stringify(createErrorResult_('SERIALIZATION_ERROR', err));
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/*
 * Apps Script ContentService mengembalikan JSON dengan MIME type yang benar,
 * tetapi tidak menyediakan API untuk menambahkan header
 * Access-Control-Allow-Origin. Karena itu pembacaan lintas domain memakai
 * JSONP, sedangkan fetch/XHR hanya dapat membaca respons jika ada proxy CORS
 * di depannya. mode: no-cors tidak digunakan karena responsnya opaque.
 */
function createErrorResult_(code, err) {
  var message = String(err && err.message ? err.message : err || 'Kesalahan tidak diketahui');
  try {
    Logger.log('[Dwisyafitriproject][' + code + '] ' + message);
  } catch (_) {}
  return {
    ok: false,
    errorCode: code,
    message: message
  };
}

function parseQueryPayload_(value) {
  if (value == null || value === '') return null;
  try {
    return JSON.parse(String(value));
  } catch (err) {
    return {
      value: String(value),
      parseError: true
    };
  }
}

function getSafeJsonpCallback_(value) {
  var callback = String(value || '').trim();
  return /^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback)
    ? callback
    : '';
}

function createJsonpResponse_(callback, value) {
  var json;
  try {
    json = JSON.stringify(value);
  } catch (err) {
    json = JSON.stringify(createErrorResult_('JSONP_SERIALIZATION_ERROR', err));
  }
  return ContentService
    .createTextOutput(callback + '(' + json + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function getWebAppManifest_() {
  var url = ScriptApp.getService().getUrl() || '';
  return {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: 'Katalog produk dan kasir Dwisyafitriproject',
    start_url: url || './',
    scope: url || './',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7fee7',
    theme_color: '#F3F4F6',
    icons: [
      { src: (url || '') + '?icon=1', sizes: '192x192', type: 'image/svg+xml' },
      { src: (url || '') + '?icon=1', sizes: '512x512', type: 'image/svg+xml' }
    ]
  };
}

function handleAction(action, payload) {
  var actionName = String(action || '').trim();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return {
        ok: false,
        errorCode: 'SPREADSHEET_NOT_FOUND',
        message: 'Spreadsheet aktif tidak ditemukan. Pastikan script terikat pada Spreadsheet yang benar.'
      };
    }

    switch (actionName) {
      case 'getPublicProduk': return getPublicProduk(ss);
      case 'getProduk': return getSheetData(ss, 'Produk');
      case 'saveProduk': return saveSheetRow(ss, 'Produk', payload);
      case 'deleteProduk': return deleteSheetRow(ss, 'Produk', payload);

      case 'getPenjualan': return getSheetData(ss, 'Penjualan');
      case 'savePenjualan': return saveSheetRow(ss, 'Penjualan', payload);
      case 'deletePenjualan': return deleteSheetRow(ss, 'Penjualan', payload);

      case 'getPengeluaran': return getSheetData(ss, 'Pengeluaran');
      case 'savePengeluaran': return saveSheetRow(ss, 'Pengeluaran', payload);
      case 'deletePengeluaran': return deleteSheetRow(ss, 'Pengeluaran', payload);

      case 'getReview': return getSheetData(ss, 'Review');
      case 'addReview': return saveSheetRow(ss, 'Review', payload);
      case 'updateReview': return updateReviewRow(ss, payload);
      case 'deleteReview': return deleteSheetRow(ss, 'Review', payload);

      case 'loginAdmin': return checkAdminLogin(ss, payload);
      case 'uploadFoto': return uploadFotoDrive(payload);
      case 'uploadReceiptPdfToDrive': return uploadReceiptPdfToDrive(payload);
      case 'sendReceiptWhatsApp': return sendReceiptWhatsApp(payload);
      case 'createReceiptPdfAndSendWhatsApp': return createReceiptPdfAndSendWhatsApp(payload);
      default:
        return {
          ok: false,
          errorCode: 'UNKNOWN_ACTION',
          message: 'Aksi tidak dikenal: ' + actionName
        };
    }
  } catch (err) {
    return createErrorResult_('BACKEND_ERROR', err);
  }
}

function normalizeHeader_(value) {
  return String(value == null ? '' : value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

function getPublicProduk(ss) {
  var sheet = ss.getSheetByName('Produk');
  if (!sheet) {
    sheet = ss.insertSheet('Produk');
    initSheetHeaderAndDefaultData(sheet, 'Produk');
  }

  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { ok: true, data: [] };

  var headers = values[0].map(normalizeHeader_);
  var columns = [
    'ID', 'NAMA', 'DESKRIPSI', 'HARGA',
    'FOTO_URL', 'FOTO_URL2', 'FOTO_URL3',
    'LINK', 'LINK_DESAIN', 'STATUS'
  ];
  var aliases = {
    ID: ['ID', 'ID_PRODUK', 'KODE', 'KODE_PRODUK'],
    NAMA: ['NAMA', 'NAMA_PRODUK', 'NAMA_BARANG', 'NAME'],
    DESKRIPSI: ['DESKRIPSI', 'DESKRIPSI_PRODUK', 'DESCRIPTION', 'KETERANGAN'],
    HARGA: ['HARGA', 'PRICE', 'HARGA_JUAL'],
    FOTO_URL: ['FOTO_URL', 'FOTO', 'FOTO_1', 'GAMBAR', 'IMAGE', 'IMAGE_URL'],
    FOTO_URL2: ['FOTO_URL2', 'FOTO_2', 'GAMBAR_2', 'IMAGE_2'],
    FOTO_URL3: ['FOTO_URL3', 'FOTO_3', 'GAMBAR_3', 'IMAGE_3'],
    LINK: ['LINK', 'LINK_PESAN', 'URL_PESAN'],
    LINK_DESAIN: ['LINK_DESAIN', 'DESAIN', 'URL_DESAIN'],
    STATUS: ['STATUS', 'TAMPILKAN', 'VISIBILITAS']
  };
  var index = {};

  columns.forEach(function(column) {
    var possible = aliases[column] || [column];
    for (var i = 0; i < possible.length; i++) {
      var found = headers.indexOf(normalizeHeader_(possible[i]));
      if (found >= 0) {
        index[column] = found;
        break;
      }
    }
  });

  var list = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var id = index.ID === undefined ? '' : String(row[index.ID] || '').trim();
    var name = index.NAMA === undefined ? '' : String(row[index.NAMA] || '').trim();
    if (!id && !name) continue;

    if (index.STATUS !== undefined) {
      var status = String(row[index.STATUS] || '').trim().toLowerCase();
      if (
        status === 'disembunyikan' ||
        status === 'sembunyikan' ||
        status === 'hidden' ||
        status === 'tidak'
      ) continue;
    }

    var item = {};
    columns.forEach(function(column) {
      item[column] = index[column] === undefined ? '' : row[index[column]];
    });
    list.push(item);
  }

  return { ok: true, data: list };
}

function getSheetData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    initSheetHeaderAndDefaultData(sheet, sheetName);
  }

  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { ok: true, data: [] };

  var headers = values[0];
  var list = [];
  for (var r = 1; r < values.length; r++) {
    var item = {};
    for (var c = 0; c < headers.length; c++) {
      item[normalizeHeader_(headers[c])] = values[r][c];
    }
    list.push(item);
  }
  return { ok: true, data: list };
}

function parsePayload_(payload) {
  if (typeof payload === 'string') {
    try { return JSON.parse(payload); } catch (_) { return {}; }
  }
  return payload || {};
}

function saveSheetRow(ss, sheetName, payload) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    initSheetHeaderAndDefaultData(sheet, sheetName);
  }

  var data = parsePayload_(payload);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  if (!data.ID) {
    data.ID = sheetName.substring(0, 1).toUpperCase() + new Date().getTime();
  }

  if (sheetName === 'Penjualan') {
    if (!data.TANGGAL) data.TANGGAL = new Date().toISOString();
    if (!data.NO_TRANSAKSI) {
      var now = new Date();
      var date = now.getFullYear() +
        ('0' + (now.getMonth() + 1)).slice(-2) +
        ('0' + now.getDate()).slice(-2);
      data.NO_TRANSAKSI = 'TRX-' + date + '-' + Math.floor(1000 + Math.random() * 9000);
    }
  }
  if (sheetName === 'Pengeluaran' && !data.TANGGAL) {
    data.TANGGAL = new Date().toISOString();
  }

  var rowNumber = -1;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]) === String(data.ID)) {
      rowNumber = r + 1;
      break;
    }
  }

  var row = headers.map(function(header) {
    var key = normalizeHeader_(header);
    return data[key] !== undefined ? data[key] : '';
  });

  if (rowNumber > 0) {
    sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  SpreadsheetApp.flush();
  return getSheetData(ss, sheetName);
}

function deleteSheetRow(ss, sheetName, payload) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { ok: false, message: 'Sheet tidak ditemukan.' };
  var id = parsePayload_(payload).ID || payload;
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]) === String(id)) {
      sheet.deleteRow(r + 1);
      return getSheetData(ss, sheetName);
    }
  }
  return { ok: false, message: 'Data ID tidak ditemukan.' };
}

function updateReviewRow(ss, payload) {
  var sheet = ss.getSheetByName('Review');
  if (!sheet) return { ok: false, message: 'Sheet Review tidak ditemukan.' };
  var data = parsePayload_(payload);
  var target = String(data.ID || '').trim();
  if (!target) return { ok: false, message: 'ID ulasan tidak boleh kosong.' };

  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]).trim() !== target) continue;
    var row = headers.map(function(header, c) {
      var key = normalizeHeader_(header);
      return data[key] !== undefined && data[key] !== null ? data[key] : values[r][c];
    });
    sheet.getRange(r + 1, 1, 1, row.length).setValues([row]);
    SpreadsheetApp.flush();
    return getSheetData(ss, 'Review');
  }
  return { ok: false, message: 'Ulasan ID "' + target + '" tidak ditemukan.' };
}

function checkAdminLogin(ss, payload) {
  var data = parsePayload_(payload);
  var user = String(data.username || data.USERNAME || '').trim();
  var pass = String(data.password || data.PASSWORD || '').trim();

  if (
    (user === 'admin' && pass === 'admin123') ||
    (user === 'admin' && pass === 'admin')
  ) return { ok: true, username: 'admin' };

  var sheet = ss.getSheetByName('Admin');
  if (sheet) {
    var values = sheet.getDataRange().getValues();
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][0]).trim() === user && String(values[r][1]).trim() === pass) {
        return { ok: true, username: user };
      }
    }
  }
  return { ok: false, message: 'Username atau Password salah.' };
}

function initSheetHeaderAndDefaultData(sheet, sheetName) {
  if (sheetName === 'Produk') {
    sheet.appendRow(['ID', 'NAMA', 'DESKRIPSI', 'HARGA', 'FOTO_URL', 'FOTO_URL2', 'FOTO_URL3', 'LINK', 'LINK_DESAIN', 'STATUS']);
  } else if (sheetName === 'Penjualan') {
    sheet.appendRow(['ID', 'NO_TRANSAKSI', 'TANGGAL', 'NAMA_PEMBELI', 'WHATSAPP', 'PRODUK', 'HARGA', 'BAYAR', 'METODE', 'KEMBALIAN']);
  } else if (sheetName === 'Pengeluaran') {
    sheet.appendRow(['ID', 'TANGGAL', 'KETERANGAN', 'JUMLAH']);
  } else if (sheetName === 'Review') {
    sheet.appendRow(['ID', 'NAMA', 'WHATSAPP', 'RATING', 'REVIEW', 'TANGGAL', 'BALASAN']);
  } else if (sheetName === 'Admin') {
    sheet.appendRow(['USERNAME', 'PASSWORD']);
  }
}

function uploadFotoDrive(payload) {
  try {
    var data = parsePayload_(payload);
    var base64 = String(data.base64 || '');
    if (!base64) return { ok: false, message: 'Data foto tidak valid.' };
    var comma = base64.indexOf(',');
    var encoded = comma >= 0 ? base64.substring(comma + 1) : base64;
    var typeMatch = base64.match(/^data:([^;]+);/);
    var contentType = typeMatch ? typeMatch[1] : 'image/jpeg';
    var bytes = Utilities.base64Decode(encoded);
    var blob = Utilities.newBlob(
      bytes,
      contentType,
      data.filename || ('foto-' + new Date().getTime() + '.jpg')
    );
    var file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return {
      ok: true,
      url: 'https://lh3.googleusercontent.com/d/' + file.getId(),
      fileId: file.getId()
    };
  } catch (err) {
    return { ok: false, message: 'Gagal upload foto: ' + String(err) };
  }
}

function uploadReceiptPdfToDrive(payload) {
  try {
    var data = parsePayload_(payload);
    var base64 = String(data.base64 || '');
    var comma = base64.indexOf(',');
    if (!base64 || comma < 0) return { ok: false, message: 'Data PDF tidak valid.' };
    var bytes = Utilities.base64Decode(base64.substring(comma + 1));
    var blob = Utilities.newBlob(
      bytes,
      'application/pdf',
      data.filename || ('struk-' + new Date().getTime() + '.pdf')
    );
    var folder = getReceiptFolder_(data.folderName || 'Struk Transaksi Dwisyafitriproject');
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return {
      ok: true,
      fileUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
      fileId: file.getId(),
      filename: file.getName()
    };
  } catch (err) {
    return { ok: false, message: 'Gagal menyimpan PDF: ' + String(err) };
  }
}

function getReceiptFolder_(name) {
  var props = PropertiesService.getScriptProperties();
  var savedId = props.getProperty(RECEIPT_FOLDER_PROPERTY);
  if (savedId) {
    try { return DriveApp.getFolderById(savedId); } catch (_) {}
  }
  var folder = DriveApp.createFolder(name || 'Struk Transaksi');
  props.setProperty(RECEIPT_FOLDER_PROPERTY, folder.getId());
  return folder;
}

function setupReceiptFolder() {
  var folder = getReceiptFolder_('Struk Transaksi Dwisyafitriproject');
  return { ok: true, folderId: folder.getId(), folderUrl: folder.getUrl() };
}

function authorizeDriveAccess() {
  return setupReceiptFolder();
}

function normalizeWhatsAppPhone_(value) {
  var phone = String(value || '').replace(/\D/g, '');
  return phone.indexOf('0') === 0 ? '62' + phone.substring(1) : phone;
}

function sendReceiptWhatsApp(payload) {
  var data = parsePayload_(payload);
  var phone = normalizeWhatsAppPhone_(data.phone);
  if (phone.length < 8) return { ok: false, message: 'Nomor WhatsApp tidak valid.' };

  var receipt = uploadReceiptPdfToDrive(data);
  if (!receipt.ok) return receipt;
  var props = PropertiesService.getScriptProperties();
  var token = String(props.getProperty('WHATSAPP_ACCESS_TOKEN') || '');
  var phoneId = String(props.getProperty('WHATSAPP_PHONE_NUMBER_ID') || '');
  if (!token || !phoneId) {
    return {
      ok: true,
      sent: false,
      manualSend: true,
      fileUrl: receipt.fileUrl,
      filename: receipt.filename,
      message: 'PDF tersimpan. WhatsApp Cloud API belum dikonfigurasi.'
    };
  }

  var version = String(props.getProperty('WHATSAPP_API_VERSION') || 'v20.0');
  var text = String(data.message || 'Berikut link struk transaksi Anda: ' + receipt.fileUrl)
    .replace(/\{\{PDF_LINK\}\}/g, receipt.fileUrl);
  var response = UrlFetchApp.fetch(
    'https://graph.facebook.com/' + version + '/' + phoneId + '/messages',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { preview_url: true, body: text }
      }),
      muteHttpExceptions: true
    }
  );
  var result = JSON.parse(response.getContentText() || '{}');
  if (!result.messages || !result.messages.length) {
    return { ok: false, fileUrl: receipt.fileUrl, message: response.getContentText() };
  }
  return { ok: true, sent: true, fileUrl: receipt.fileUrl, messageId: result.messages[0].id };
}

function createReceiptPdfAndSendWhatsApp(payload) {
  return sendReceiptWhatsApp(payload);
}

function renderReceiptPage_(token) {
  return HtmlService.createHtmlOutput(
    '<!doctype html><html lang="id"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Struk Pembayaran</title>' +
    '<body style="font-family:Arial;padding:32px;text-align:center">' +
    '<h2>Struk Pembayaran</h2><p>Token struk: ' +
    escapeHtml_(token) + '</p><p>Gunakan link PDF yang dikirimkan kepada Anda.</p>' +
    '</body></html>'
  ).setTitle('Struk Pembayaran');
}

function escapeHtml_(value) {
  return String(value || '').replace(/[&<>"']/g, function(character) {
    return {
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#39;'
    }[character];
  });
}
