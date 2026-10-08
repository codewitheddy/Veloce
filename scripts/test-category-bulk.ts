import {
  getAllSqliteCategories,
  saveSqliteCategories,
  deleteSqliteCategory,
  deleteSqliteCategoriesBulk,
  updateSqliteCategoriesBulk,
} from '../src/lib/sqlite-db';

async function testCategoryBulkOperations() {
  console.log('--- Testing Category Bulk Operations ---');

  // 1. Seed test categories
  const testCats = [
    { id: 'cat-test-1', name: 'Test Electronics', slug: 'test-electronics', parentId: null, status: 'Active', displayOrder: 1 },
    { id: 'cat-test-2', name: 'Test Phones', slug: 'test-phones', parentId: 'cat-test-1', status: 'Active', displayOrder: 1 },
    { id: 'cat-test-3', name: 'Test Cases', slug: 'test-cases', parentId: 'cat-test-2', status: 'Active', displayOrder: 1 },
    { id: 'cat-test-4', name: 'Test Fashion', slug: 'test-fashion', parentId: null, status: 'Active', displayOrder: 2 },
    { id: 'cat-test-5', name: 'Test Shirts', slug: 'test-shirts', parentId: 'cat-test-4', status: 'Active', displayOrder: 1 },
  ];

  await saveSqliteCategories(testCats);
  let fetched = await getAllSqliteCategories();
  console.log(`✓ Seeded ${fetched.length} test categories.`);

  // 2. Test Bulk Status Change
  const updatedCount = await updateSqliteCategoriesBulk(['cat-test-1', 'cat-test-4'], { status: 'Inactive' });
  console.log(`✓ Bulk updated ${updatedCount} categories to Inactive.`);
  fetched = await getAllSqliteCategories();
  const c1 = fetched.find(c => c.id === 'cat-test-1');
  const c4 = fetched.find(c => c.id === 'cat-test-4');
  if (c1?.status !== 'Inactive' || c4?.status !== 'Inactive') {
    throw new Error('Status update failed');
  }

  // 3. Test Bulk Delete (Reassign / Single Batch)
  const deletedCount = await deleteSqliteCategoriesBulk(['cat-test-1', 'cat-test-4']);
  console.log(`✓ Bulk deleted ${deletedCount} categories.`);
  fetched = await getAllSqliteCategories();
  const remainingIds = fetched.map(c => c.id);
  if (remainingIds.includes('cat-test-1') || remainingIds.includes('cat-test-4')) {
    throw new Error('Bulk delete failed: deleted categories still exist');
  }
  console.log(`✓ Remaining categories count: ${fetched.length} (${remainingIds.join(', ')})`);

  // 4. Test Purge / All Deleted persistence without auto-resurrection
  await deleteSqliteCategoriesBulk(remainingIds);
  const emptyCats = await getAllSqliteCategories();
  if (emptyCats.length !== 0) {
    throw new Error(`Expected 0 categories after full deletion, got ${emptyCats.length}`);
  }
  console.log('✓ Successfully confirmed 0 categories persisted without resurrection.');

  // 5. Restore standard sample categories for clean environment
  const standardCats = [
    { id: 'cat-1', name: 'Electronics', slug: 'electronics', parentId: null, description: 'Smartphones, Audio, Tech', status: 'Active', displayOrder: 1 },
    { id: 'cat-2', name: 'Fashion', slug: 'fashion', parentId: null, description: 'Apparel and Footwear', status: 'Active', displayOrder: 2 },
    { id: 'cat-3', name: 'Home & Living', slug: 'home-living', parentId: null, description: 'Furniture & Decor', status: 'Active', displayOrder: 3 },
    { id: 'cat-4', name: 'Beauty & Fragrances', slug: 'beauty-fragrances', parentId: null, description: 'Personal Care', status: 'Active', displayOrder: 4 },
  ];
  await saveSqliteCategories(standardCats);
  const finalCats = await getAllSqliteCategories();
  console.log(`✓ Final clean state restored with ${finalCats.length} categories.`);
  console.log('--- ALL CATEGORY TESTS PASSED ---');
}

testCategoryBulkOperations().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
