import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Alembic 当前实现架构书',
  description: '沿真实代码链理解 Alembic 的结构事实、知识生产、宿主消费、新鲜度与验证',
  lang: 'zh-CN',
  base: '/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['link', { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
  ],

  markdown: {
    math: true,
  },

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Alembic Book',

    nav: [
      { text: '首页', link: '/' },
      { text: '架构速览', link: '/visual-tour' },
      { text: '开始阅读', link: '/part1/ch01-system-map' },
      {
        text: '相关链接',
        items: [
          { text: 'Alembic GitHub', link: 'https://github.com/GxFn/Alembic' },
          { text: 'AlembicBook GitHub', link: 'https://github.com/GxFn/AlembicBook' },
          { text: '博客', link: 'https://gaoxuefeng.com' },
        ],
      },
    ],

    sidebar: [
      {
            "text": "架构速览",
            "link": "/visual-tour"
      },
      {
            "text": "Part I · 系统地图",
            "collapsed": false,
            "items": [
                  {
                        "text": "当前系统地图",
                        "link": "/part1/ch01-system-map"
                  },
                  {
                        "text": "用户项目到知识层",
                        "link": "/part1/ch02-user-journey"
                  },
                  {
                        "text": "仓库边界与依赖方向",
                        "link": "/part1/ch03-repository-boundaries"
                  }
            ]
      },
      {
            "text": "Part II · 事实内核与结构证据",
            "collapsed": false,
            "items": [
                  {
                        "text": "Core Contract Spine",
                        "link": "/part2/ch04-core-contract-spine"
                  },
                  {
                        "text": "项目模型和存储",
                        "link": "/part2/ch05-project-model-storage"
                  },
                  {
                        "text": "ProjectContext、检索与 Guard",
                        "link": "/part2/ch06-analysis-search-guard"
                  }
            ]
      },
      {
            "text": "Part III · 项目运行与知识生产",
            "collapsed": false,
            "items": [
                  {
                        "text": "主运行时",
                        "link": "/part3/ch07-local-runtime"
                  },
                  {
                        "text": "Daemon / HTTP / Jobs",
                        "link": "/part3/ch08-daemon-http-jobs"
                  },
                  {
                        "text": "计划、Cold Start 与 Rescan",
                        "link": "/part3/ch09-cold-start-rescan"
                  }
            ]
      },
      {
            "text": "Part IV · 宿主消费与交付",
            "collapsed": false,
            "items": [
                  {
                        "text": "MCP 请求链与工具表面",
                        "link": "/part4/ch10-codex-plugin-surface"
                  },
                  {
                        "text": "Host Agent Workflow",
                        "link": "/part4/ch11-host-agent-workflows"
                  },
                  {
                        "text": "Skills 与交付",
                        "link": "/part4/ch12-skills-delivery"
                  }
            ]
      },
      {
            "text": "Part V · 执行器、UI 与 Provider",
            "collapsed": false,
            "items": [
                  {
                        "text": "Agent Runtime 与工具",
                        "link": "/part5/ch13-agent-runtime-tools"
                  },
                  {
                        "text": "Dashboard 前端体验",
                        "link": "/part5/ch14-dashboard-ui"
                  },
                  {
                        "text": "AI 配置边界",
                        "link": "/part5/ch15-ai-configuration"
                  }
            ]
      },
      {
            "text": "Part VI · 知识对象、新鲜度与治理",
            "collapsed": false,
            "items": [
                  {
                        "text": "Knowledge / Candidate / Recipe",
                        "link": "/part6/ch16-knowledge-model"
                  },
                  {
                        "text": "新鲜度、Evolution 与 Governance",
                        "link": "/part6/ch17-evolution-governance"
                  },
                  {
                        "text": "Guard 与决策记录",
                        "link": "/part6/ch18-guard-decision-records"
                  }
            ]
      },
      {
            "text": "Part VII · 验证、证据与维护",
            "collapsed": false,
            "items": [
                  {
                        "text": "发布与验证",
                        "link": "/part7/ch19-release-validation"
                  },
                  {
                        "text": "测试、证据与验收",
                        "link": "/part7/ch20-testing-evidence"
                  },
                  {
                        "text": "阅读路径与维护",
                        "link": "/part7/ch21-reading-maintenance"
                  }
            ]
      },
      {
            "text": "附录",
            "collapsed": true,
            "items": [
                  {
                        "text": "当前实现快照",
                        "link": "/appendix/implementation-snapshot"
                  },
                  {
                        "text": "配置和运行目录",
                        "link": "/appendix/config-reference"
                  },
                  {
                        "text": "Public API Map",
                        "link": "/appendix/public-api-map"
                  },
                  {
                        "text": "MCP Tool Surface",
                        "link": "/appendix/mcp-tools"
                  },
                  {
                        "text": "术语表",
                        "link": "/appendix/glossary"
                  }
            ]
      }
],

    outline: {
      level: [2, 3],
      label: '本页目录',
    },

    editLink: {
      pattern: 'https://github.com/GxFn/AlembicBook/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页',
    },

    lastUpdated: {
      text: '最后更新',
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
          modal: {
            noResultsText: '没有找到相关结果',
            resetButtonTitle: '清除查询',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
          },
        },
      },
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/GxFn/Alembic' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 GaoXuefeng',
    },

    docFooter: {
      prev: '上一章',
      next: '下一章',
    },
  },
})
