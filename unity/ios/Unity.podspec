require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'Unity'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  
  s.platforms      = {
    :ios => '13.0', # Ajustei para 13.0 que é um padrão seguro para Expo/Unity atual
    :tvos => '13.0'
  }
  s.swift_version  = '5.4' # 5.9 pode dar conflito dependendo do Xcode, 5.4 é safer
  s.source         = { git: 'https://github.com/ItsJuniorDias/Magic-World/unity' }
  
  s.static_framework = true

  # 1. Definição dos Arquivos Fonte
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
  
  # 🔥 A CORREÇÃO DO ERRO RedefinePlatforms.h 🔥
  # Isso impede o CocoaPods de ler os headers internos da Unity como source
  s.exclude_files = "UnityFramework.framework/**/*"

  # 2. Configuração do Framework Unity
  s.vendored_frameworks = 'UnityFramework.framework'
  s.preserve_paths = 'UnityFramework.framework'
  s.resources = ['Data']

  # 3. Configurações de Compilação
  s.pod_target_xcconfig = { 
    'DEFINES_MODULE' => 'YES',
    'FRAMEWORK_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)"',
    'OTHER_LDFLAGS' => '-framework UnityFramework'
  }

  s.dependency 'ExpoModulesCore'

  # OBS: Só mantenha essa linha se você CRIOU o arquivo Bridging-Header.h na pasta ios.
  # Se não criou, comente a linha abaixo para evitar erro de "File not found".
  s.prefix_header_file = 'Bridging-Header.h'
end