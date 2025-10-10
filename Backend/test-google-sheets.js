require('dotenv').config()
const googleSheets = require('./src/utils/googleSheets')

async function testGoogleSheetsIntegration() {
  console.log('🧪 Testing Google Sheets Integration...')

  try {
    // Initialize Google Sheets
    console.log('📡 Initializing Google Sheets...')
    await googleSheets.initialize()
    console.log('✅ Google Sheets initialized successfully!')

    // Test connection
    console.log('📋 Testing spreadsheet access...')
    console.log(`📄 Spreadsheet ID: ${process.env.GOOGLE_SHEETS_SPREADSHEET_ID}`)
    console.log(`📧 Service Account: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`)

    // Test appending sample data
    console.log('📝 Testing data append...')
    const testData = {
      student_id: 'TEST-001',
      student_name: 'Test Student',
      grade_level: 'Grade 5',
      grade_category: 'gradeSchool',
      activity_type: 'computer',
      equipment_id: 'COMP-01',
      start_time: new Date().toISOString(),
      status: 'completed',
      processed_by: 'Sophia'
    }

    await googleSheets.appendStudentActivity(testData)
    console.log('✅ Sample data appended successfully!')

    // Test automation logging
    console.log('⚙️ Testing automation logging...')
    await googleSheets.logAutomationTask({
      task_name: 'Google Sheets Test',
      task_type: 'sync',
      status: 'completed',
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      details: 'Test completed successfully - Google Sheets integration is working!'
    })
    console.log('✅ Automation task logged successfully!')

    console.log('🎉 All Google Sheets tests passed!')
    console.log('📊 Your Google Sheet should now contain:')
    console.log('   - Student Activities sheet with test data')
    console.log('   - Automation Logs sheet with test entry')

  } catch (error) {
    console.error('❌ Google Sheets test failed:', error.message)
    console.error('🔍 Please ensure:')
    console.error('   1. The Google Sheet is shared with the service account email')
    console.error('   2. The service account has editor permissions')
    console.error('   3. The credentials file is correct')
    process.exit(1)
  }
}

testGoogleSheetsIntegration()