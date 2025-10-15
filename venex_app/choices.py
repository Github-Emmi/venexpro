
# ✅ Gender Choices
GENDER_CHOICES = [
    ('M', 'Male'),
    ('F', 'Female'),
    ('O', 'Other'),
]

# ✅ User Activity Types
ACTIVITY_TYPES = [
    ('LOGIN', 'User Login'),
    ('LOGOUT', 'User Logout'),
    ('DEPOSIT', 'Deposit'),
    ('WITHDRAW', 'Withdraw'),
    ('TRADE', 'Trade'),
    ('PROFILE_UPDATE', 'Profile Update'),
    ('KYC_VERIFICATION', 'KYC Verification'),
]

# ✅ Transaction Types
TRANSACTION_TYPES = [
    ('BUY', 'Buy'),
    ('SELL', 'Sell'),
    ('DEPOSIT', 'Deposit'),
    ('WITHDRAWAL', 'Withdrawal'),
]

# ✅ Cryptocurrency Options
CRYPTO_CHOICES = [
    ('BTC', 'Bitcoin'),
    ('ETH', 'Ethereum'),
    ('USDT', 'Tether (USDT)'),
    ('LTC', 'Litecoin'),
    ('TRX', 'Tron'),
]

# ✅ Currency Options (for deposits/withdrawals)
CURRENCY_CHOICES = [
    ('USD', 'US Dollar'),
    ('EUR', 'Euro'),
    ('GBP', 'British Pound'),
    ('NGN', 'Nigerian Naira'),
    ('USDT', 'Tether USD'),
    ('BTC', 'Bitcoin'),
]

# ✅ Transaction Statuses
STATUS_CHOICES = [
    ('PENDING', 'Pending'),
    ('COMPLETED', 'Completed'),
    ('FAILED', 'Failed'),
    ('CANCELLED', 'Cancelled'),
]

# ✅ Order Types
ORDER_TYPES = [
    ('MARKET', 'Market Order'),
    ('LIMIT', 'Limit Order'),
    ('STOP_LOSS', 'Stop Loss'),
    ('TAKE_PROFIT', 'Take Profit'),
]

# ✅ Order Status
ORDER_STATUS_CHOICES = [
    ('OPEN', 'Open'),
    ('FILLED', 'Filled'),
    ('CANCELLED', 'Cancelled'),
    ('PARTIALLY_FILLED', 'Partially Filled'),
    ('EXPIRED', 'Expired'),
]

# ✅ Buy/Sell Side
SIDE_CHOICES = [
    ('BUY', 'Buy'),
    ('SELL', 'Sell'),
]

# ✅ Time-in-Force Choices
TIME_IN_FORCE_CHOICES = [
    ('GTC', 'Good Till Cancelled'),
    ('IOC', 'Immediate or Cancel'),
    ('FOK', 'Fill or Kill'),
]


Currency = (
('USD', 'America United States Dollars – USD'),
("AFN", "Afghanistan Afghanis – AFN"),
("ALL", "Albania Leke – ALL"),
("DZD", "Algeria Dinars – DZD"),
("ARS", "Argentina Pesos – ARS"),
("AUD", "Australia Dollars – AUD"),
("ATS", "Austria Schillings – ATS"),
("BSD", "Bahamas Dollars – BSD"),
("BHD", "Bahrain Dinars – BHD"),
("BDT", "Bangladesh Taka – BDT"),
("BBD", "Barbados Dollars – BBD"),
("BEF", "Belgium Francs – BEF"),
("BMD", "Bermuda Dollars – BMD"),
 
("BRL", "Brazil Reais – BRL"),
("BGN", "Bulgaria Leva – BGN"),
("CAD", "Canada Dollars – CAD"),
("XOF", "CFA BCEAO Francs – XOF"),
("XAF", "CFA BEAC Francs – XAF"),
("CLP", "Chile Pesos – CLP"),
 
("CNY", "China Yuan Renminbi – CNY"),
("CNY", "RMB (China Yuan Renminbi), – CNY"),
("COP", "Colombia Pesos – COP"),
("XPF", "CFP Francs – XPF"),
("CRC", "Costa Rica Colones – CRC"),
("HRK", "Croatia Kuna – HRK"),
 
("CYP", "Cyprus Pounds – CYP"),
("CZK", "Czech Republic Koruny – CZK"),
("DKK", "Denmark Kroner – DKK"),
("DEM", "Deutsche (Germany), Marks – DEM"),
("DOP", "Dominican Republic Pesos – DOP"),
("NLG", "Dutch (Netherlands), Guilders – NLG"),
 
("XCD", "Eastern Caribbean Dollars – XCD"),
("EGP", "Egypt Pounds – EGP"),
("EEK", "Estonia Krooni – EEK"),
("EUR", "Euro – EUR"),
("FJD", "Fiji Dollars – FJD"),
("FIM", "Finland Markkaa – FIM"),
 
("FRF", "France Francs – FRF"),
("DEM", "Germany Deutsche Marks – DEM"),
("XAU", "Gold Ounces – XAU"),
("GRD", "Greece Drachmae – GRD"),
("GTQ", "Guatemalan Quetzal – GTQ"),
("NLG", "Holland (Netherlands), Guilders – NLG"),
("HKD", "Hong Kong Dollars – HKD"),
 
("HUF", "Hungary Forint – HUF"),
("ISK", "Iceland Kronur – ISK"),
("XDR", "IMF Special Drawing Right – XDR"),
("INR", "India Rupees – INR"),
("IDR", "Indonesia Rupiahs – IDR"),
("IRR", "Iran Rials – IRR"),
 
("IQD", "Iraq Dinars – IQD"),
("IEP", "Ireland Pounds – IEP"),
("ILS", "Israel New Shekels – ILS"),
("ITL", "Italy Lire – ITL"),
("JMD", "Jamaica Dollars – JMD"),
("JPY", "Japan Yen – JPY"),
 
("JOD", "Jordan Dinars – JOD"),
("KES", "Kenya Shillings – KES"),
("KRW", "Korea (South), Won – KRW"),
("KWD", "Kuwait Dinars – KWD"),
("LBP", "Lebanon Pounds – LBP"),
("LUF", "Luxembourg Francs – LUF"),
 
("MYR", "Malaysia Ringgits – MYR"),
("MTL", "Malta Liri – MTL"),
("MUR", "Mauritius Rupees – MUR"),
("MXN", "Mexico Pesos – MXN"),
("MAD", "Morocco Dirhams – MAD"),
("NLG", "Netherlands Guilders – NLG"),
 
("NZD", "New Zealand Dollars – NZD"),
("NGN", "Nigeria Naira – NGN"),
("NOK", "Norway Kroner – NOK"),
("OMR", "Oman Rials – OMR"),
("PKR", "Pakistan Rupees – PKR"),
("XPD", "Palladium Ounces – XPD"),
("PEN", "Peru Nuevos Soles – PEN"),
 
("PHP", "Philippines Pesos – PHP"),
("XPT", "Platinum Ounces – XPT"),
("PLN", "Poland Zlotych – PLN"),
("PTE", "Portugal Escudos – PTE"),
("QAR", "Qatar Riyals – QAR"),
("RON", "Romania New Lei – RON"),
 
("ROL", "Romania Lei – ROL"),
("RUB", "Russia Rubles – RUB"),
("SAR", "Saudi Arabia Riyals – SAR"),
("XAG", "Silver Ounces – XAG"),
("SGD", "Singapore Dollars – SGD"),
("SKK", "Slovakia Koruny – SKK"),
 
("SIT", "Slovenia Tolars – SIT"),
("ZAR", "South Africa Rand – ZAR"),
("KRW", "South Korea Won – KRW"),
("ESP", "Spain Pesetas – ESP"), 
 
("SDD", "Sudan Dinars – SDD"),
("SEK", "Sweden Kronor – SEK"),
("CHF", "Switzerland Francs – CHF"),
("TWD", "Taiwan New Dollars – TWD"),
("THB", "Thailand Baht – THB"),
("TTD", "Trinidad and Tobago Dollars – TTD"),
 
("TND", "Tunisia Dinars – TND"),
("TRY", "Turkey New Lira – TRY"),
("AED", "United Arab Emirates Dirhams – AED"),
("GBP", "United Kingdom Pounds – GBP"),
("USD", "United States Dollars – USD"),
("VEB", "Venezuela Bolivares – VEB"),
 
("VND", "Vietnam Dong – VND"),
("ZMK", "Zambia Kwacha – ZMK"),
)