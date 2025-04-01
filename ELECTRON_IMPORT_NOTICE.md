# 重要提示：Electron导入方式

由于Electron应用在打包后可能面临ESM URL协议问题，请改用以下方式导入Electron模块:

```javascript
// 不要使用这种方式 (会导致electron:协议的ESM加载错误)
import { app, BrowserWindow } from 'electron';
import path from 'path';

// 正确的导入方式
const { app, BrowserWindow } = require('electron');
const path = require('path');
```

这种修改可以防止在打包后的应用中出现以下错误:

```
Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: Only URLs with a scheme in: file and data are supported by the default ESM loader. Received protocol 'electron:'
```

如果您需要在TypeScript中使用类型，可以这样做:

```typescript
// 导入类型 (不会导致运行时问题)
import type { BrowserWindow as BrowserWindowType } from 'electron';

// 导入模块 (使用require避免ESM问题)
const { app, BrowserWindow } = require('electron');
```
