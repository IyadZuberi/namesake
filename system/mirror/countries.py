"""Countries: full ISO 3166-1 list + common names + demonyms -> canonical ISO alpha-2 code.

parse_country(text) -> code | None      one value (a name, a code or a demonym)
parse_place(text)    -> code | None      "Santa Prisca, Quito, Ecuador [Business]" -> last comma part
scan_text(text)      -> set of codes     every country name / demonym / code found in free text
"International" and "Europe" are not countries (NOT_COUNTRIES).
"""
import re
import unicodedata

# CODE|alpha3|Name|alias;alias|demonym;demonym   (territories are their own country)
_TABLE = """
AF|AFG|Afghanistan||Afghan
AX|ALA|Aland Islands|Aland|Alandic
AL|ALB|Albania||Albanian
DZ|DZA|Algeria||Algerian
AS|ASM|American Samoa||American Samoan
AD|AND|Andorra||Andorran
AO|AGO|Angola||Angolan
AI|AIA|Anguilla||Anguillan
AQ|ATA|Antarctica||
AG|ATG|Antigua and Barbuda|Antigua;Barbuda|Antiguan;Barbudan
AR|ARG|Argentina||Argentine;Argentinian;Argentinean
AM|ARM|Armenia||Armenian
AW|ABW|Aruba||Aruban
AU|AUS|Australia||Australian
AT|AUT|Austria||Austrian
AZ|AZE|Azerbaijan||Azerbaijani;Azeri
BS|BHS|Bahamas|The Bahamas|Bahamian
BH|BHR|Bahrain||Bahraini
BD|BGD|Bangladesh||Bangladeshi
BB|BRB|Barbados||Barbadian;Bajan
BY|BLR|Belarus|Byelorussia|Belarusian;Belorussian
BE|BEL|Belgium||Belgian
BZ|BLZ|Belize||Belizean
BJ|BEN|Benin||Beninese
BM|BMU|Bermuda||Bermudian
BT|BTN|Bhutan||Bhutanese
BO|BOL|Bolivia|Plurinational State of Bolivia|Bolivian
BQ|BES|Bonaire|Sint Eustatius;Saba;Caribbean Netherlands|
BA|BIH|Bosnia and Herzegovina|Bosnia;Herzegovina;Bosnia-Herzegovina|Bosnian;Herzegovinian
BW|BWA|Botswana||Botswanan;Motswana
BV|BVT|Bouvet Island||
BR|BRA|Brazil|Brasil|Brazilian
IO|IOT|British Indian Ocean Territory||
BN|BRN|Brunei|Brunei Darussalam|Bruneian
BG|BGR|Bulgaria||Bulgarian
BF|BFA|Burkina Faso||Burkinabe
BI|BDI|Burundi||Burundian
CV|CPV|Cape Verde|Cabo Verde|Cape Verdean
KH|KHM|Cambodia||Cambodian
CM|CMR|Cameroon||Cameroonian
CA|CAN|Canada||Canadian
KY|CYM|Cayman Islands|Cayman|Caymanian
CF|CAF|Central African Republic||
TD|TCD|Chad||Chadian
CL|CHL|Chile||Chilean
CN|CHN|China|People's Republic of China;PRC;Mainland China|Chinese
CX|CXR|Christmas Island||
CC|CCK|Cocos Islands|Cocos (Keeling) Islands;Keeling Islands|
CO|COL|Colombia||Colombian
KM|COM|Comoros||Comorian
CG|COG|Congo|Republic of the Congo;Congo-Brazzaville;Congo Brazzaville|Congolese
CD|COD|Democratic Republic of the Congo|DR Congo;DRC;Congo-Kinshasa;Congo Kinshasa;Zaire|
CK|COK|Cook Islands||
CR|CRI|Costa Rica||Costa Rican
CI|CIV|Ivory Coast|Cote d'Ivoire;Cote dIvoire;Cte d'Ivoire;Cte dIvoire|Ivorian
HR|HRV|Croatia||Croatian
CU|CUB|Cuba||Cuban
CW|CUW|Curacao||Curacaoan
CY|CYP|Cyprus||Cypriot
CZ|CZE|Czech Republic|Czechia|Czech
DK|DNK|Denmark||Danish;Dane
DJ|DJI|Djibouti||Djiboutian
DM|DMA|Dominica||Dominican
DO|DOM|Dominican Republic||
EC|ECU|Ecuador||Ecuadorian;Ecuadorean
EG|EGY|Egypt||Egyptian
SV|SLV|El Salvador||Salvadoran;Salvadorian
GQ|GNQ|Equatorial Guinea||Equatoguinean
ER|ERI|Eritrea||Eritrean
EE|EST|Estonia||Estonian
SZ|SWZ|Eswatini|Swaziland|Swazi
ET|ETH|Ethiopia||Ethiopian
FK|FLK|Falkland Islands|Falklands;Malvinas|Falkland Islander
FO|FRO|Faroe Islands|Faroes|Faroese
FJ|FJI|Fiji||Fijian
FI|FIN|Finland||Finnish;Finn
FR|FRA|France||French
GF|GUF|French Guiana||
PF|PYF|French Polynesia||
TF|ATF|French Southern Territories||
GA|GAB|Gabon||Gabonese
GM|GMB|Gambia|The Gambia|Gambian
GE|GEO|Georgia||Georgian
DE|DEU|Germany|Deutschland|German
GH|GHA|Ghana||Ghanaian
GI|GIB|Gibraltar||Gibraltarian
GR|GRC|Greece||Greek;Hellenic
GL|GRL|Greenland||Greenlandic;Greenlander
GD|GRD|Grenada||Grenadian
GP|GLP|Guadeloupe||Guadeloupean
GU|GUM|Guam||Guamanian
GT|GTM|Guatemala||Guatemalan
GG|GGY|Guernsey||
GN|GIN|Guinea||Guinean
GW|GNB|Guinea-Bissau|Guinea Bissau|Bissau-Guinean
GY|GUY|Guyana||Guyanese
HT|HTI|Haiti||Haitian
HM|HMD|Heard Island and McDonald Islands||
VA|VAT|Vatican City|Holy See;Vatican|Vatican
HN|HND|Honduras||Honduran
HK|HKG|Hong Kong|Hong Kong SAR;Hong Kong Special Administrative Region of China|Hong Konger
HU|HUN|Hungary||Hungarian
IS|ISL|Iceland||Icelandic;Icelander
IN|IND|India||Indian
ID|IDN|Indonesia||Indonesian
IR|IRN|Iran|Islamic Republic of Iran|Iranian;Persian
IQ|IRQ|Iraq||Iraqi
IE|IRL|Ireland|Republic of Ireland;Eire|Irish
IM|IMN|Isle of Man||Manx
IL|ISR|Israel||Israeli
IT|ITA|Italy||Italian
JM|JAM|Jamaica||Jamaican
JP|JPN|Japan||Japanese
JE|JEY|Jersey||
JO|JOR|Jordan||Jordanian
KZ|KAZ|Kazakhstan||Kazakh;Kazakhstani
KE|KEN|Kenya||Kenyan
KI|KIR|Kiribati||I-Kiribati
KP|PRK|North Korea|Democratic People's Republic of Korea;DPRK;Korea North|North Korean
KR|KOR|South Korea|Republic of Korea;Korea South;Korea|South Korean;Korean
XK|XKX|Kosovo||Kosovar;Kosovan
KW|KWT|Kuwait||Kuwaiti
KG|KGZ|Kyrgyzstan|Kyrgyz Republic|Kyrgyz
LA|LAO|Laos|Lao People's Democratic Republic|Laotian;Lao
LV|LVA|Latvia||Latvian
LB|LBN|Lebanon||Lebanese
LS|LSO|Lesotho||Basotho
LR|LBR|Liberia||Liberian
LY|LBY|Libya||Libyan
LI|LIE|Liechtenstein||Liechtensteiner
LT|LTU|Lithuania||Lithuanian
LU|LUX|Luxembourg||Luxembourgish;Luxembourger
MO|MAC|Macao|Macau;Macao Special Administrative Region of China;Macau SAR|Macanese
MG|MDG|Madagascar||Malagasy
MW|MWI|Malawi||Malawian
MY|MYS|Malaysia||Malaysian
MV|MDV|Maldives||Maldivian
ML|MLI|Mali||Malian
MT|MLT|Malta||Maltese
MH|MHL|Marshall Islands||Marshallese
MQ|MTQ|Martinique||Martiniquais
MR|MRT|Mauritania||Mauritanian
MU|MUS|Mauritius||Mauritian
YT|MYT|Mayotte||
MX|MEX|Mexico||Mexican
FM|FSM|Micronesia|Federated States of Micronesia|Micronesian
MD|MDA|Moldova|Republic of Moldova|Moldovan
MC|MCO|Monaco||Monegasque;Monacan
MN|MNG|Mongolia||Mongolian
ME|MNE|Montenegro||Montenegrin
MS|MSR|Montserrat||Montserratian
MA|MAR|Morocco||Moroccan
MZ|MOZ|Mozambique||Mozambican
MM|MMR|Myanmar|Burma|Burmese;Myanmarese
NA|NAM|Namibia||Namibian
NR|NRU|Nauru||Nauruan
NP|NPL|Nepal||Nepalese;Nepali
NL|NLD|Netherlands|The Netherlands;Holland|Dutch;Netherlander
NC|NCL|New Caledonia||
NZ|NZL|New Zealand||New Zealander;Kiwi
NI|NIC|Nicaragua||Nicaraguan
NE|NER|Niger||Nigerien
NG|NGA|Nigeria||Nigerian
NU|NIU|Niue||Niuean
NF|NFK|Norfolk Island||
MK|MKD|North Macedonia|Macedonia;Republic of North Macedonia|Macedonian
MP|MNP|Northern Mariana Islands||
NO|NOR|Norway||Norwegian
OM|OMN|Oman||Omani
PK|PAK|Pakistan||Pakistani
PW|PLW|Palau||Palauan
PS|PSE|Palestine|Palestina;State of Palestine;Palestinian Territories;West Bank;Gaza;Gaza Strip|Palestinian
PA|PAN|Panama||Panamanian
PG|PNG|Papua New Guinea||Papua New Guinean
PY|PRY|Paraguay||Paraguayan
PE|PER|Peru||Peruvian
PH|PHL|Philippines|The Philippines|Filipino;Philippine;Filipina
PN|PCN|Pitcairn Islands|Pitcairn|
PL|POL|Poland||Polish;Pole
PT|PRT|Portugal||Portuguese
PR|PRI|Puerto Rico||Puerto Rican
QA|QAT|Qatar||Qatari
RE|REU|Reunion||
RO|ROU|Romania||Romanian
RU|RUS|Russia|Russian Federation|Russian
RW|RWA|Rwanda||Rwandan
BL|BLM|Saint Barthelemy|St Barthelemy;St Barths|
SH|SHN|Saint Helena|St Helena;Ascension;Tristan da Cunha|
KN|KNA|Saint Kitts and Nevis|St Kitts and Nevis;Saint Kitts;St Kitts;Nevis|Kittitian;Nevisian
LC|LCA|Saint Lucia|St Lucia|Saint Lucian
MF|MAF|Saint Martin|St Martin|
PM|SPM|Saint Pierre and Miquelon|St Pierre and Miquelon|
VC|VCT|Saint Vincent and the Grenadines|St Vincent and the Grenadines;Saint Vincent;St Vincent|Vincentian
WS|WSM|Samoa||Samoan
SM|SMR|San Marino||Sammarinese
ST|STP|Sao Tome and Principe|Sao Tome|Sao Tomean
SA|SAU|Saudi Arabia|Kingdom of Saudi Arabia;KSA|Saudi;Saudi Arabian
SN|SEN|Senegal||Senegalese
RS|SRB|Serbia||Serbian;Serb
SC|SYC|Seychelles||Seychellois
SL|SLE|Sierra Leone||Sierra Leonean
SG|SGP|Singapore||Singaporean
SX|SXM|Sint Maarten||
SK|SVK|Slovakia|Slovak Republic|Slovak;Slovakian
SI|SVN|Slovenia||Slovenian;Slovene
SB|SLB|Solomon Islands||Solomon Islander
SO|SOM|Somalia||Somali
ZA|ZAF|South Africa||South African
GS|SGS|South Georgia and the South Sandwich Islands|South Georgia|
SS|SSD|South Sudan||South Sudanese
ES|ESP|Spain||Spanish;Spaniard
LK|LKA|Sri Lanka||Sri Lankan
SD|SDN|Sudan||Sudanese
SR|SUR|Suriname||Surinamese
SJ|SJM|Svalbard and Jan Mayen|Svalbard|
SE|SWE|Sweden||Swedish;Swede
CH|CHE|Switzerland||Swiss
SY|SYR|Syria|Syrian Arab Republic|Syrian
TW|TWN|Taiwan|Republic of China|Taiwanese
TJ|TJK|Tajikistan||Tajik
TZ|TZA|Tanzania|United Republic of Tanzania|Tanzanian
TH|THA|Thailand||Thai
TL|TLS|Timor-Leste|East Timor;Timor Leste|Timorese
TG|TGO|Togo||Togolese
TK|TKL|Tokelau||
TO|TON|Tonga||Tongan
TT|TTO|Trinidad and Tobago|Trinidad;Tobago|Trinidadian;Tobagonian
TN|TUN|Tunisia||Tunisian
TR|TUR|Turkey|Turkiye|Turkish
TM|TKM|Turkmenistan||Turkmen
TC|TCA|Turks and Caicos Islands|Turks and Caicos|
TV|TUV|Tuvalu||Tuvaluan
UG|UGA|Uganda||Ugandan
UA|UKR|Ukraine||Ukrainian
AE|ARE|United Arab Emirates|UAE;Emirates|Emirati;Emirian
GB|GBR|United Kingdom|UK;Great Britain;Britain;England;Scotland;Wales;Northern Ireland;United Kingdom of Great Britain and Northern Ireland|British;English;Scottish;Scots;Welsh;Briton
US|USA|United States|United States of America;USA;America;U.S.;U.S.A.|American
UM|UMI|United States Minor Outlying Islands||
UY|URY|Uruguay||Uruguayan
UZ|UZB|Uzbekistan||Uzbek;Uzbekistani
VU|VUT|Vanuatu||Ni-Vanuatu
VE|VEN|Venezuela|Bolivarian Republic of Venezuela|Venezuelan
VN|VNM|Vietnam|Viet Nam|Vietnamese
VG|VGB|British Virgin Islands|Virgin Islands British;BVI|
VI|VIR|US Virgin Islands|United States Virgin Islands;Virgin Islands US|
WF|WLF|Wallis and Futuna||
EH|ESH|Western Sahara||Sahrawi
YE|YEM|Yemen||Yemeni
ZM|ZMB|Zambia||Zambian
ZW|ZWE|Zimbabwe||Zimbabwean
"""

NOT_COUNTRIES = {"international", "europe", "worldwide", "global"}

CODES = {}      # alpha-2 / alpha-3 (upper case) -> alpha-2
NAMES = {}      # normalised name / alias / demonym -> alpha-2
DISPLAY = {}    # alpha-2 -> English display name


def norm(text):
    """Lower case, accents stripped, apostrophes dropped, other punctuation -> space."""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    text = text.replace("�", "").replace("'", "").replace("’", "")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text).split())


def _build():
    for line in _TABLE.strip().splitlines():
        code, a3, name, aliases, demonyms = line.split("|")
        DISPLAY[code] = name
        CODES[code] = code
        CODES[a3] = code
        for label in [name] + [a for a in aliases.split(";") if a] + [d for d in demonyms.split(";") if d]:
            key = norm(label)
            if key:
                NAMES.setdefault(key, code)
    # bare "the" prefixes are stripped at lookup time; "uk"/"usa" are explicit aliases above
    CODES["UK"] = "GB"


_build()
# ambiguous demonyms: scan_text returns every reading, parse_country refuses (unparsed -> no clear)
AMBIGUOUS = {
    "congolese": {"CG", "CD"}, "congo": {"CG", "CD"},
    "dominican": {"DM", "DO"},
    "korean": {"KR", "KP"}, "korea": {"KR", "KP"},
}
_SCAN_RX = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in sorted(NAMES, key=lambda k: (-len(k), k))) + r")\b"
)
_CODE_RX = re.compile(r"(?<![A-Za-z])([A-Z]{2,3})(?![A-Za-z])")


def display(code):
    return DISPLAY.get(code, code)


def parse_country(text):
    """One value -> alpha-2 or None. Strips '[Associated]' style suffixes."""
    if not text or not isinstance(text, str):
        return None
    text = re.sub(r"\s*\[[^\]]*\]", "", text).strip()
    if not text:
        return None
    key = norm(text)
    if key in NOT_COUNTRIES:
        return None
    if key in AMBIGUOUS:
        return None
    if key.startswith("the ") and key[4:] in NAMES:
        key = key[4:]
    if key in NAMES:
        return NAMES[key]
    if text.upper() == text and text in CODES:
        return CODES[text]
    return None


def is_non_country(text):
    return bool(text) and norm(re.sub(r"\s*\[[^\]]*\]", "", text)) in NOT_COUNTRIES


def parse_place(text):
    """'Street, City, Country [Tag]' -> the country of the last comma part."""
    if not text or not isinstance(text, str):
        return None
    text = re.sub(r"\s*\[[^\]]*\]", "", text).strip()
    return parse_country(text.split(",")[-1].strip())


def scan_text(text, codes=True):
    """Every country name / demonym / upper-case code in free text (over-inclusive on purpose)."""
    out = set()
    if not text:
        return out
    low = norm(text)
    for m in _SCAN_RX.finditer(low):
        out.add(NAMES[m.group(1)])
        out |= AMBIGUOUS.get(m.group(1), set())
    for m in (_CODE_RX.finditer(text) if codes else ()):
        code = CODES.get(m.group(1))
        if code:
            out.add(code)
    return out
