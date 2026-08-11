# Component Templates

Vendored open-source React components from Aceternity UI and Magic UI.

## Sources

### Aceternity UI
- **Repository**: https://github.com/aceternity/ui
- **License**: MIT
- **Components**: 3D cards, spotlight effects, pin containers, magnetic buttons, glowing beams, text reveals, parallax scroll, floating navbars, hover border gradients

### Magic UI
- **Repository**: https://github.com/magicuidesign/magicui
- **License**: MIT
- **Components**: Marquees, animated numbers, docks, globes, particles, word rotate, shimmer buttons, CSS grid backgrounds

## Usage

Components are indexed by name, category, and tags. The code-gen model searches this index when a user prompt requests specific UI patterns.

```typescript
import { searchComponents, getComponentsByCategory } from './index'

// Search by keyword
const results = searchComponents('3d card', 5)

// Get all components in a category
const buttons = getComponentsByCategory('button')
```

## License Compliance

Both Aceternity UI and Magic UI are MIT licensed. The source code is vendored (copied) into this directory for internal use by the code generation system. The components are not redistributed as-is; they are adapted and embedded into generated websites.

For attribution requirements, see:
- Aceternity UI: https://ui.aceternity.com/docs
- Magic UI: https://magicui.design/docs
