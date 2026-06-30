// client-side parsing functions — injected as raw text into HTML at build time
// (do NOT embed in template literal — backslash escapes would be corrupted)

var VALID_SCHEMES = ['메가딜', '101010', '1010', '통합', '하이브리드'];
var PRODUCT_ALIAS = { '통살': '닭가슴살', '닭다리살': '닭다리', '순살닭다리살': '닭다리' };

function parseCampaignName(name) {
  // 앞 더미 제거
  var clean = name.replace(/^["']+/, '').replace(/^(_x_)+/, '').replace(/^_+/, '').trim();

  // 번호 prefix: NN. 또는 NN_
  var prefixM = clean.match(/^(\d+)[._]/);
  var afterPrefix = prefixM ? clean.slice(prefixM[0].length) : clean;

  // 품목: 첫 (, _, -, [ 전까지
  var productM = afterPrefix.match(/^([^(_\-\[]+)/);
  var product = productM ? productM[1].trim() : '-';
  product = PRODUCT_ALIAS[product] || product;

  // 스킴: (ASC)(스킴) 형태 → (ASC) 바로 다음 () — 화이트리스트만 허용
  var scheme = '-';
  var ascIdx = clean.indexOf('(ASC)');
  if (ascIdx >= 0) {
    var afterASC = clean.slice(ascIdx + 5);
    var schemeM = afterASC.match(/^\(([^)]+)\)/);
    if (schemeM && VALID_SCHEMES.indexOf(schemeM[1]) >= 0) {
      scheme = schemeM[1];
    }
  }

  // 코드명: ASC형식 vs 신형식 분기
  var code = '-';
  if (clean.indexOf('(ASC)') < 0) {
    // 신형식: 괄호 안 숫자 (2968), (2580), (3036/오픈)
    var parenCodeM = clean.match(/\((\d{3,5})(?:\/[^)]+)?\)/);
    if (parenCodeM) code = parenCodeM[1];
  } else {
    // ASC형식: 끝 4자리 숫자 (생성일자 앞, 2자리 suffix 제거 후)
    var dateFirst = clean.match(/_(\d{6})$/);
    var codeBase = dateFirst ? clean.slice(0, clean.length - dateFirst[0].length) : clean.replace(/_\d{2}$/, '');
    var codeM = codeBase.match(/_(\d{4})$/);
    if (codeM) code = codeM[1];
  }

  // 유형: TROAS, TCPA, 기본 ASC
  var up = clean.toUpperCase();
  var campType = 'ASC';
  if (up.indexOf('TROAS') >= 0) campType = 'TROAS';
  else if (up.indexOf('TCPA') >= 0) campType = 'TCPA';

  // 생성일자: 끝 6자리 (26XXXX)
  var dateM = clean.match(/_(\d{6})$/);
  var createDate = (dateM && /^2[3-9]/.test(dateM[1])) ? dateM[1] : '-';

  return { product: product, campType: campType, scheme: scheme, code: code, createDate: createDate };
}

function parseAdName(name) {
  var clean = name.replace(/\s*-\s*사본.*$/, '').trim();
  var parts = clean.split('_');
  var setDate = /^\d{6}$/.test(parts[0]) ? parts[0] : '-';
  var productCode = (parts[1] && /^[A-Z]{2,6}$/.test(parts[1])) ? parts[1] : '-';
  var prodIdx = -1;
  for (var i = 0; i < parts.length; i++) { if (parts[i] === 'prod') { prodIdx = i; break; } }
  var code = (prodIdx >= 0 && prodIdx + 1 < parts.length && /^\d{4,5}$/.test(parts[prodIdx + 1])) ? parts[prodIdx + 1] : '-';
  var concept = parts.length > 5 ? parts[5] : '-';
  var rawCT = prodIdx > 0 ? parts[prodIdx - 1] : '';
  var creativeType = '-';
  if (/^릴스/.test(rawCT)) creativeType = '릴스';
  else if (/^이미지/.test(rawCT)) creativeType = '이미지';
  else if (/^영상/.test(rawCT)) creativeType = '릴스';
  return { setDate: setDate, productCode: productCode, concept: concept, code: code, creativeType: creativeType };
}
