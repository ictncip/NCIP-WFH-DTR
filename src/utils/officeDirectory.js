export const OFFICE_EMAIL_NAME_MAP = {
  'abra@danglas.ncip': 'ABRA, DANGLAS',
  'abra@licuanbaay.ncip': 'ABRA, LICUAN-BAAY',
  'abra@manabo.ncip': 'ABRA, MANABO',
  'abra@po.ncip': 'ABRA, PO',
  'apayao@conner.ncip': 'APAYAO, CONNER',
  'apayao@kabugao.ncip': 'APAYAO, KABUGAO',
  'apayao@luna.ncip': 'APAYAO, LUNA',
  'apayao@po.ncip': 'APAYAO, PO',
  'baguio@csc.ncip': 'BAGUIO CSC',
  'baguio@co.ncip': 'BAGUIO, CO',
  'benguet@po.ncip': 'BENGUET PO',
  'benguet@atok.ncip': 'BENGUET, ATOK',
  'benguet@bokod.ncip': 'BENGUET, BOKOD',
  'benguet@itogon.ncip': 'BENGUET, ITOGON',
  'benguet@sablan.ncip': 'BENGUET, SABLAN',
  'centraloffice@oehr.ncip': 'CENTRAL OFFICE, OEHR',
  'ifugao@aguinaldo.ncip': 'IFUGAO, AGUINALDO',
  'ifugao@banaue.ncip': 'IFUGAO, BANAUE',
  'ifugao@po.ncip': 'IFUGAO, PO',
  'ifugao@tinoc.ncip': 'IFUGAO, TINOC',
  'kalinga@balbalan.ncip': 'KALINGA, BALBALAN',
  'kalinga@po.ncip': 'KALINGA, PO',
  'kalinga@tanudan.ncip': 'KALINGA, TANUDAN',
  'kalinga@tinglayan.ncip': 'KALINGA, TINGLAYAN',
  'mountain@po.ncip': 'MOUNTAIN PO',
  'mountain@panaba.ncip': 'MOUNTAIN, PANABA',
  'mountain@sabata.ncip': 'MOUNTAIN, SABATA',
  'mountain@sabebosa.ncip': 'MOUNTAIN, SABEBOSA',
  'ro@fasd.ncip': 'RO-FASD',
  'ro@ord.ncip': 'RO-ORD',
  'ro@rhu.ncip': 'RO-RHU',
  'ro@tmsd.ncip': 'RO-TMSD'
};

export const getOfficeDisplayName = (email) => {
  if (!email) return '';
  const key = email.toLowerCase();
  if (OFFICE_EMAIL_NAME_MAP[key]) return OFFICE_EMAIL_NAME_MAP[key];

  const atIndex = key.indexOf('@');
  if (atIndex === -1) return '';

  const left = key.slice(0, atIndex);
  const right = key.slice(atIndex + 1);
  const rightParts = right.split('.');
  const office = rightParts[0] || '';

  if (!left || !office) return '';

  const normalize = (value) => value.replace(/[-_]/g, ' ').toUpperCase();
  return `${normalize(left)}, ${normalize(office)}`;
};
