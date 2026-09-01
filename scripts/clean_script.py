import re

with open('src/components/DashboardAnalytics.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Available Categories & custom categories
text = text.replace(
'''    products.forEach((p) => {
      if (p.category) existing.add(p.category);
    });
    affiliateOffers.forEach((a) => {
      if (a.category) existing.add(a.category);
    });''',
'''    products.forEach((p) => {
      if (p.category) existing.add(p.category);
    });'''
)

text = text.replace(
'''  const availableCategories = React.useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    affiliateOffers.forEach((a) => {
      if (a.category) cats.add(a.category);
    });
    return Array.from(cats).sort();
  }, [products, affiliateOffers]);''',
'''  const availableCategories = React.useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [products]);'''
)

# 2. Affiliate state definitions
old_aff_states = '''  // New affiliate product form state
  const [newAffName, setNewAffName] = useState('');
  const [newAffMerchant, setNewAffMerchant] = useState('');
  const [newAffDesc, setNewAffDesc] = useState('');
  const [newAffPrice, setNewAffPrice] = useState(150);
  const [newAffComm, setNewAffComm] = useState(10);
  const [newAffCategory, setNewAffCategory] = useState('Workspace');
  const [newAffImg, setNewAffImg] = useState('https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&q=80&w=600');
  const [newAffUrl, setNewAffUrl] = useState('https://partner.example.com/item?ref=veloce');
  const [showAddAffPage, setShowAddAffPage] = useState(false);'''
text = text.replace(old_aff_states, '')

# 3. useEffect top-scroll dependency array
text = text.replace(
    '[adminSubTab, affiliateAdminSubView, showAddProdPage, showAddAffPage, editingProduct, selectedAdminDetailOrder]',
    '[adminSubTab, showAddProdPage, editingProduct, selectedAdminDetailOrder]'
)

# 4. Security audit logs
text = text.replace(
    'Evaluated active memory: ${products.length} Products, ${orders.length} Orders, ${campaigns.length} Campaigns',
    'Evaluated active memory: ${products.length} Products, ${orders.length} Orders'
)

# 5. Filtered click logs & payout logs memo
old_logs_memo = '''  const filteredClickLogsForAnalytics = React.useMemo(() => {
    if (!analyticsDateRange) return clickLogs;
    return clickLogs.filter((c) => {
      const datePart = c.timestamp.split(' ')[0].split('T')[0];
      return datePart >= analyticsDateRange.start && datePart <= analyticsDateRange.end;
    });
  }, [clickLogs, analyticsDateRange]);

  const filteredPayoutLogsForAnalytics = React.useMemo(() => {
    if (!analyticsDateRange) return payoutLogs;
    return payoutLogs.filter((p) => {
      const datePart = p.date.split(' ')[0].split('T')[0];
      return datePart >= analyticsDateRange.start && datePart <= analyticsDateRange.end;
    });
  }, [payoutLogs, analyticsDateRange]);'''

new_logs_memo = '''  const filteredClickLogsForAnalytics: any[] = [];
  const filteredPayoutLogsForAnalytics: any[] = [];'''
text = text.replace(old_logs_memo, new_logs_memo)

# 6. Affiliate commissions & earnings memo
text = text.replace(
'''  const currentPayoutBalance = React.useMemo(() => {
    if (typeof affiliateEarnings === 'number' && affiliateEarnings > 0) {
      return affiliateEarnings;
    }
    return profitabilityOverview.netRevenue;
  }, [affiliateEarnings, profitabilityOverview.netRevenue]);''',
'''  const currentPayoutBalance = profitabilityOverview.netRevenue;'''
)

# 7. Quick payout request
text = text.replace(
'''    if (onRequestPayout) {
      onRequestPayout(currentPayoutBalance);
      setPayoutNotification(`Quick Payout Request submitted for KSh ${currentPayoutBalance.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}! Request is now 'In Transit'.`);
    } else {
      setPayoutNotification(`Simulated Quick Payout Request of KSh ${currentPayoutBalance.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} processed.`);
    }''',
'''    setPayoutNotification(`Quick Payout Request of KSh ${currentPayoutBalance.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} processed.`);'''
)

# 8. CSV export and category mapping
text = text.replace(
'''      const affiliateCategoryMap = new Map<string, string>();
      affiliateOffers.forEach(a => affiliateCategoryMap.set(a.id, a.category));''',
''''''
)

# 9. Backup object
old_dash_backup = '''        meta: {
          productsCount: products.length,
          ordersCount: orders.length,
          affiliateOffersCount: affiliateOffers.length,
          campaignsCount: campaigns.length,
          clickLogsCount: clickLogs.length,
          payoutLogsCount: payoutLogs.length,
          inventoryAuditLogsCount: inventoryAuditLogs.length,
        },
        data: {
          products,
          orders,
          affiliateOffers,
          campaigns,
          clickLogs,
          payoutLogs,
          inventoryAuditLogs,
        }'''

new_dash_backup = '''        meta: {
          productsCount: products.length,
          ordersCount: orders.length,
          inventoryAuditLogsCount: inventoryAuditLogs.length,
        },
        data: {
          products,
          orders,
          inventoryAuditLogs,
        }'''
text = text.replace(old_dash_backup, new_dash_backup)

# 10. HandleCreateAffiliate
old_create_aff = '''  const handleCreateAffiliate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAffName || !newAffMerchant) return;

    const newOffer: AffiliateProduct = {
      id: 'aff-user-' + Date.now(),
      name: newAffName,
      merchant: newAffMerchant,
      description: newAffDesc,
      price: Number(newAffPrice),
      commissionRate: Number(newAffComm),
      category: newAffCategory,
      imageUrl: newAffImg,
      affiliateUrl: newAffUrl,
      clicks: 0,
      conversions: 0,
      revenueEarned: 0
    };

    onAddAffiliateOffer(newOffer);
    setShowAddAffPage(false);

    // Reset forms
    setNewAffName('');
    setNewAffMerchant('');
    setNewAffDesc('');
  };'''
text = text.replace(old_create_aff, '')

# 11. Affiliate export in CSV
old_aff_csv = '''      const affRows = [
        ...affiliateOffers.map(o => [
          o.id,
          o.name,
          o.merchant,
          'Affiliate Referral Link',
          o.clicks.toString(),
          o.conversions.toString(),
          `${o.commissionRate}% commission`,
          (o.revenueEarned || 0).toFixed(2)
        ]),
        ...campaigns.map(c => [
          c.id,
          c.name,
          c.source,
          'Marketing Traffic Campaign',
          c.clicks.toString(),
          c.conversions.toString(),
          'Direct Campaign Earner',
          (c.earnings || 0).toFixed(2)
        ])
      ];
      const affiliateCSV = convertToCSV(affHeaders, affRows);
      downloadCSV('veloce_affiliate_earnings_report.csv', affiliateCSV);'''
text = text.replace(old_aff_csv, '')

# 12. Admin feature tabs list
text = text.replace(
'''              {
                id: 'products' as const,
                buttonId: 'btn-tab-inventory',
                label: 'Inventory',
                icon: Package,
                badge: `${products.length + affiliateOffers.length}`,
                badgeType: 'count',
                iconColor: 'text-indigo-500',
              },''',
'''              {
                id: 'products' as const,
                buttonId: 'btn-tab-inventory',
                label: 'Inventory',
                icon: Package,
                badge: `${products.length}`,
                badgeType: 'count',
                iconColor: 'text-indigo-500',
              },'''
)

text = text.replace(
'''              {
                id: 'campaigns' as const,
                buttonId: 'btn-tab-campaigns',
                label: 'Referrals & Campaigns',
                icon: Users,
                badge: `${campaigns.length}`,
                badgeType: 'count',
                iconColor: 'text-indigo-500',
              },''',
''''''
)

text = text.replace(
'''              {
                id: 'payouts' as const,
                buttonId: 'btn-tab-payouts',
                label: 'Payouts',
                icon: CreditCard,
                badge: `${payoutLogs.length}`,
                badgeType: 'count',
                iconColor: 'text-indigo-500',
              },''',
''''''
)

with open('src/components/DashboardAnalytics.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('clean_script.py applied successfully!')
