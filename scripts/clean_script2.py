import re

with open('src/components/DashboardAnalytics.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove if (showAddAffPage) { ... }
# Let's use regex or substring
match = re.search(r'  if \(showAddAffPage\) \{([\s\S]*?)\n  \}\n\n  const filteredProducts', text)
if match:
    text = text.replace(match.group(0), '  const filteredProducts')
    print('Removed showAddAffPage block!')
else:
    print('showAddAffPage block not found via regex')

# 2. Remove Affiliate offers list in products tab
match2 = re.search(r'          \{/\* Affiliate offers list \*/\}[\s\S]*?          </div>\n        </div>\n      \)\}', text)
if match2:
    text = text.replace(match2.group(0), '        </div>\n      )}')
    print('Removed Affiliate offers list in products tab!')
else:
    print('Affiliate offers list not found via regex')

# 3. Remove adminSubTab === 'campaigns'
match3 = re.search(r'      \{adminSubTab === \'campaigns\' && \([\s\S]*?\n      \)\}\n', text)
if match3:
    text = text.replace(match3.group(0), '')
    print('Removed campaigns tab block!')
else:
    print('campaigns tab block not found via regex')

# 4. Remove adminSubTab === 'payouts'
match4 = re.search(r'      \{adminSubTab === \'payouts\' && \(\(\) => \{[\s\S]*?\n      \}\)\(\)\}\n', text)
if match4:
    text = text.replace(match4.group(0), '')
    print('Removed payouts tab block!')
else:
    print('payouts tab block not found via regex')

# 5. Clean Liquidity Deficit Alert banner
match5 = re.search(r'              \{/\* Liquidity Deficit Alert \*/\}[\s\S]*?\{/\* End Liquidity Alert \*/\}', text)
if match5:
    text = text.replace(match5.group(0), '')
    print('Removed Liquidity Deficit Alert!')
else:
    # Check if there is a button onClick={() => setAdminSubTab('payouts')}
    text = re.sub(r'<button[\s\S]*?onClick=\{\(\) => setAdminSubTab\(\'payouts\'\)\}[\s\S]*?</button>', '', text)
    print('Cleaned payouts button in warning')

with open('src/components/DashboardAnalytics.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('clean_script2.py executed successfully!')
