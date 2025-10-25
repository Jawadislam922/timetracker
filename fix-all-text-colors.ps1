# Global Text Color Fix Script
# Fixes white text on light backgrounds across ALL pages

$pages = @(
    "resources\js\Pages\UsersList.jsx",
    "resources\js\Pages\ClientsList.jsx",
    "resources\js\Pages\WorkHoursList.jsx",
    "resources\js\Pages\WorkHoursReport.jsx",
    "resources\js\Pages\UpworkProfiles\Index.jsx",
    "resources\js\Pages\UpworkProfiles\Create.jsx",
    "resources\js\Pages\UpworkProfiles\Edit.jsx",
    "resources\js\Pages\UserCreate.jsx",
    "resources\js\Pages\UserEdit.jsx",
    "resources\js\Pages\ClientCreate.jsx",
    "resources\js\Pages\ClientEdit.jsx",
    "resources\js\Pages\WorkHourEdit.jsx"
)

foreach ($page in $pages) {
    Write-Host "Fixing $page..." -ForegroundColor Yellow
    
    $content = Get-Content $page -Raw
    
    # Fix card backgrounds - from glass to solid white
    $content = $content -replace 'bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl','bg-white/95 backdrop-blur-xl'
    $content = $content -replace 'bg-gradient-to-br from-white/10 to-white/5','bg-white/95'
    
    # Fix borders - from white to slate
    $content = $content -replace 'border-white/10','border-slate-200'
    $content = $content -replace 'border-white/20','border-slate-300'
    
    # Fix main text colors
    $content = $content -replace 'text-white mb-2','text-slate-900 mb-2'
    $content = $content -replace 'text-white mb-4','text-slate-900 mb-4'
    $content = $content -replace 'text-white">','text-slate-900">'
    $content = $content -replace 'text-white ','text-slate-900 '
    $content = $content -replace "text-white'","text-slate-900'"
    
    # Fix faded text
    $content = $content -replace 'text-white/70','text-slate-600'
    $content = $content -replace 'text-white/60','text-slate-500'
    $content = $content -replace 'text-white/50','text-slate-400'
    
    # Fix form inputs
    $content = $content -replace 'bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl','bg-white border border-slate-300 rounded-xl'
    $content = $content -replace 'bg-white/10 backdrop-blur-xl border','bg-white border'
    $content = $content -replace 'placeholder-white/50','placeholder-slate-400'
    
    # Fix dropdowns
    $content = $content -replace 'bg-slate-800/95 backdrop-blur-xl border border-white/20','bg-white border border-slate-300'
    $content = $content -replace 'bg-slate-800 text-white','bg-white text-slate-900'
    $content = $content -replace 'hover:bg-white/20 rounded-lg text-white','hover:bg-slate-100 rounded-lg text-slate-900'
    $content = $content -replace 'hover:bg-white/20','hover:bg-slate-100'
    
    # Fix section backgrounds
    $content = $content -replace 'bg-white/5 backdrop-blur-xl','bg-slate-50'
    $content = $content -replace 'bg-white/5','bg-slate-50'
    
    # Fix labels
    $content = $content -replace 'text-sm font-medium text-white mb-2','text-sm font-medium text-slate-700 mb-2'
    $content = $content -replace 'font-medium text-white','font-medium text-slate-900'
    $content = $content -replace 'font-semibold text-white','font-semibold text-slate-900'
    $content = $content -replace 'font-bold text-white','font-bold text-slate-900'
    
    # Fix red/error colors
    $content = $content -replace 'text-red-300','text-red-600'
    $content = $content -replace 'text-red-400','text-red-500'
    
    # Fix blue/info colors
    $content = $content -replace 'text-blue-300','text-blue-600'
    $content = $content -replace 'text-blue-400','text-blue-600'
    
    # Fix purple colors
    $content = $content -replace 'text-purple-300','text-purple-600'
    
    # Fix unselected buttons
    $content = $content -replace "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white","bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
    $content = $content -replace "bg-white/10 text-white border border-white/20 hover:bg-white/20","bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
    
    Set-Content $page $content
    Write-Host "Fixed $page" -ForegroundColor Green
}

Write-Host "`nAll pages fixed!" -ForegroundColor Cyan
