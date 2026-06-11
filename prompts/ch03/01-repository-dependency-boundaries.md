Title at top in concise Chinese: "仓库依赖方向与发布边界".

Draw five repository boxes: AlembicCore, Alembic, AlembicPlugin, AlembicAgent, AlembicDashboard. Put AlembicCore as the stable contract base. Show Alembic and AlembicPlugin consuming Core; Agent consuming Core; Dashboard consuming the HTTP API/client boundary.

Add red warning markers for "禁止跨仓 internal import" and "发布前验证".
